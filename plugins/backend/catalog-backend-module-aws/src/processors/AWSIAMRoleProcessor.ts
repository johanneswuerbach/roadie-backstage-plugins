import { AWSCatalogProcessor } from './AWSCatalogProcessor';
import {
  Entity,
  ResourceEntity,
  getCompoundEntityRef,
  RELATION_DEPENDS_ON,
  RELATION_DEPENDENCY_OF,
} from '@backstage/catalog-model';
import {
  CatalogProcessorEmit,
  LocationSpec,
  processingResult,
} from '@backstage/plugin-catalog-backend';
import { ANNOTATION_AWS_IAM_ROLE_ARN } from '../annotations';
import { Config } from '@backstage/config';
import * as winston from 'winston';
import { PluginEndpointDiscovery } from '@backstage/backend-common';
import { CatalogClient, CatalogApi } from '@backstage/catalog-client';

export class AWSIAMRoleProcessor extends AWSCatalogProcessor {
  static fromConfig(
    _config: Config,
    options: { logger: winston.Logger; discovery: PluginEndpointDiscovery },
  ) {
    const catalogApi: CatalogApi = new CatalogClient({
      discoveryApi: options.discovery,
    });
    return new AWSIAMRoleProcessor({ catalogApi, ...options });
  }

  getProcessorName(): string {
    return 'aws-iam-role';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (!this.validateEntityKind(entity)) {
      return entity;
    }

    const resource = entity as ResourceEntity;

    if (
      !(
        resource.metadata?.annotations &&
        Object.keys(resource.metadata?.annotations).includes(
          ANNOTATION_AWS_IAM_ROLE_ARN,
        )
      )
    ) {
      return resource;
    }

    const relatedEntities = await this.catalogApi.getEntities({
      filter: {
        [`metadata.annotations.${ANNOTATION_AWS_IAM_ROLE_ARN}`]:
          resource.metadata.annotations[ANNOTATION_AWS_IAM_ROLE_ARN],
      },
    });

    relatedEntities.items.forEach(relatedEntity => {
      emit(
        processingResult.relation({
          type: RELATION_DEPENDS_ON,
          target: getCompoundEntityRef(entity),
          source: getCompoundEntityRef(relatedEntity),
        }),
      );
      emit(
        processingResult.relation({
          type: RELATION_DEPENDENCY_OF,
          target: getCompoundEntityRef(relatedEntity),
          source: getCompoundEntityRef(entity),
        }),
      );
    });
    return resource;
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    if (!(entity.kind === 'Resource')) {
      return false;
    }
    const resource = entity as ResourceEntity;
    if (!(resource.spec.type === 'aws-role')) {
      return false;
    }
    if (
      !(
        resource.metadata?.annotations &&
        Object.keys(resource.metadata?.annotations).includes(
          ANNOTATION_AWS_IAM_ROLE_ARN,
        )
      )
    ) {
      return false;
    }
    // we've confirmed now that we are processing an AWS IAM Role resource entity
    return true;
  }
}
