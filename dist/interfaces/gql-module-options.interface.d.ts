import { ExecutableSchemaTransformation } from '@graphql-tools/schema';
import { IResolverValidationOptions } from '@graphql-tools/utils';
import { Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { ApolloServerPluginLandingPageGraphQLPlaygroundOptions, Config, GraphQLExecutor } from 'apollo-server-core';
import { GraphQLSchema } from 'graphql';
import { ServerOptions } from 'graphql-ws';
import { ServerOptions as SubscriptionTransportWsServerOptions } from 'subscriptions-transport-ws';
import { DefinitionsGeneratorOptions } from '../graphql-ast.explorer';
import { BuildSchemaOptions } from './build-schema-options.interface';
export interface ServerRegistration {
    path?: string;
    cors?: any | boolean;
    bodyParserConfig?: any | boolean;
    onHealthCheck?: (req: any) => Promise<any>;
    disableHealthCheck?: boolean;
}
export declare type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
export declare type GraphQLWsSubscriptionsConfig = Partial<Pick<ServerOptions, 'connectionInitWaitTimeout' | 'onConnect' | 'onDisconnect' | 'onClose' | 'onSubscribe' | 'onNext'>> & {
    path?: string;
};
export declare type GraphQLSubscriptionTransportWsConfig = Partial<Pick<SubscriptionTransportWsServerOptions, 'onConnect' | 'onDisconnect' | 'keepAlive'>> & {
    path?: string;
};
export declare type SubscriptionConfig = {
    'graphql-ws'?: GraphQLWsSubscriptionsConfig | boolean;
    'subscriptions-transport-ws'?: GraphQLSubscriptionTransportWsConfig | boolean;
};
export declare type Enhancer = 'guards' | 'interceptors' | 'filters';
export interface GqlModuleOptions extends Omit<Config, 'typeDefs' | 'subscriptions'>, Partial<ServerRegistration> {
    typeDefs?: string | string[];
    typePaths?: string[];
    include?: Function[];
    executorFactory?: (schema: GraphQLSchema) => GraphQLExecutor | Promise<GraphQLExecutor>;
    installSubscriptionHandlers?: boolean;
    subscriptions?: SubscriptionConfig;
    resolverValidationOptions?: IResolverValidationOptions;
    directiveResolvers?: any;
    schemaDirectives?: Record<string, any>;
    schemaTransforms?: ExecutableSchemaTransformation[];
    transformSchema?: (schema: GraphQLSchema) => GraphQLSchema | Promise<GraphQLSchema>;
    playground?: boolean | ApolloServerPluginLandingPageGraphQLPlaygroundOptions;
    definitions?: {
        path?: string;
        outputAs?: 'class' | 'interface';
    } & DefinitionsGeneratorOptions;
    autoSchemaFile?: string | boolean;
    buildSchemaOptions?: BuildSchemaOptions;
    useGlobalPrefix?: boolean;
    fieldResolverEnhancers?: Enhancer[];
    sortSchema?: boolean;
    transformAutoSchemaFile?: boolean;
    autoTransformHttpErrors?: boolean;
}
export interface GqlOptionsFactory {
    createGqlOptions(): Promise<GqlModuleOptions> | GqlModuleOptions;
}
export interface GqlModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<GqlOptionsFactory>;
    useClass?: Type<GqlOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<GqlModuleOptions> | GqlModuleOptions;
    inject?: any[];
}
