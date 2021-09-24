const {
  CloudFormationClient,
  paginateDescribeStackEvents
} = require('@aws-sdk/client-cloudformation')

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
  const client = new CloudFormationClient({ region })
  const seen = new Set()
  let complete = false

  while (!complete) {
    const paginator = paginateDescribeStackEvents(
      { client },
      { StackName: stackId }
    )
    const events = []
    let stopPagination = false
    for await (const page of paginator) {
      for (const event of page.StackEvents || []) {
        if (seen.has(event.EventId)) {
          // We've seen this event before. Every event after this is older
          // than the current event (which we have also seen). No need to
          // continue further.
          stopPagination = true
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
            stopPagination = true
            break
          }

          // If the stack resource is in COMPLETE state, assume the stack operation
          // has concluded.
          complete = /_COMPLETE$/.test(event.ResourceStatus)
        }
      }

      if (stopPagination) {
        // We got everything we came here for. Stop the current polling iteration.
        break
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
