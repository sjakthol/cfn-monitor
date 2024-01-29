const {
  CloudFormationClient,
  paginateDescribeStackEvents
} = require('@aws-sdk/client-cloudformation')

/**
 * Generator that yields all progress events from given CloudFormation stack
 * @param {string} stackId - StackId of the Stack to monitor.
 * @param {string} [region] - AWS region of the stack.
 *
 * @yields {StackEvent} - CloudFormation stack event.
 */
async function * getStackEvents (stackId, region) {
  const client = new CloudFormationClient({ region, maxAttempts: 10 })
  const paginator = paginateDescribeStackEvents({ client }, { StackName: stackId })
  for await (const page of paginator) {
    yield * (page.StackEvents || [])
  }
}

/**
 * Generator that yields progress events from given CloudFormation stack.
 *
 * @param {string} stackName - StackName of the Stack to monitor.
 * @param {string} stackId - StackId of the Stack to monitor.
 * @param {string} [region] - AWS region of the stack.
 * @param {number} [pollInterval=1000] - Stack event polling interval (ms).
 */
async function * streamStackEvents (
  stackName,
  stackId,
  region,
  pollInterval = 1000
) {
  const seen = new Set()
  let complete = false

  while (!complete) {
    const events = []
    for await (const event of getStackEvents(stackId, region)) {
      if (seen.has(event.EventId)) {
        // We've already seen this event. Every event after this is older
        // than the current event. No need to continue further.
        break
      }

      events.push(event)
      seen.add(event.EventId)

      if (
        event.LogicalResourceId === stackName &&
        event.ResourceType === 'AWS::CloudFormation::Stack'
      ) {
        if (event.ResourceStatusReason === 'User Initiated') {
          // We've reached the event that started the latest stack operation. Every
          // event after this is older than the latest stack operation. No need to
          // continue further
          break
        }

        // If the stack resource is in COMPLETE or FAILED state, assume the stack operation
        // has concluded.
        complete = complete || /_COMPLETE|_FAILED$/.test(event.ResourceStatus)
      }
    }

    yield * events.reverse()

    if (!complete) {
      // Stack not ready. Sleep before next update
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }
  }
}

module.exports = {
  streamStackEvents
}
