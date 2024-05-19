import { CloudFormationClient } from "@aws-sdk/client-cloudformation";

const STACK_ARN_RGX = /arn:aws:cloudformation:([^:]+):\d+:stack\/([^/]+)\/[^" \n]+/;

/**
 * @typedef {Object} StackInfo
 * @property {string} arn the ARN of the stack
 * @property {string} name the name of the stack
 * @property {string} region the region the stack belongs to
 */

/**
 * Parse the CloudFormation stack ARN from the input data.
 *
 * @param {string} input the data read from stdin
 * @return {StackInfo} stack information object or null if a stack ARN
 * was not found from the input
 */
function getStackInfoFromInput(input) {
  const match = input.match(STACK_ARN_RGX);
  if (!match) {
    return null;
  }

  return { arn: match[0], region: match[1], name: match[2] };
}

/**
 * Create a CloudFormation client with some defaults and the given
 * configuration.
 *
 * @param {import('@aws-sdk/client-cloudformation').CloudFormationClientConfig} config
 * @returns {CloudFormationClient} a CloudFormation client
 */
function getCloudFormationClient(config) {
  return new CloudFormationClient({ maxAttempts: 10, ...config });
}

export default {
  getCloudFormationClient,
  getStackInfoFromInput,
};
