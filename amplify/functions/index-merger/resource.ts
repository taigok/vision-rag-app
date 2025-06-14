import { defineFunction } from '@aws-amplify/backend';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export const indexMerger = defineFunction((scope) => {
  const fn = new Function(scope, 'IndexMerger', {
    runtime: Runtime.PYTHON_3_12,
    handler: 'handler.handler',
    code: Code.fromAsset('amplify/functions/index-merger/src'),
    environment: {
      VECTOR_BUCKET: 'vector-files',
    },
    timeout: Duration.seconds(900),
    memorySize: 2048,
  });

  // Add EventBridge schedule rule
  const rule = new Rule(scope, 'IndexMergerSchedule', {
    schedule: Schedule.rate(Duration.minutes(15)),
  });
  rule.addTarget(new LambdaFunction(fn));

  return fn;
}, {
  resourceGroupName: 'functions'
});