const SampleStackEventsPerPollingRound = [
  [
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      ResourceStatus: 'CREATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0000'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      ResourceStatus: 'UPDATE_IN_PROGRESS',
      ResourceStatusReason: 'User Initiated',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0001'
    },
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic',
      ResourceStatus: 'CREATE_IN_PROGRESS',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0002'
    }
  ],
  [],
  [
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic',
      ResourceStatus: 'CREATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0003'
    },
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic2',
      ResourceStatus: 'UPDATE_IN_PROGRESS',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0004'
    },
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic2',
      ResourceStatus: 'UPDATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0005'
    }
  ],
  [
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      ResourceStatus: 'CREATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0006'
    }
  ]
]

const SampleStackEventsPerPollingRoundSimple = [
  [
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'UPDATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0005'
    },
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic',
      PhysicalResourceId: 'test-topic',
      ResourceStatus: 'UPDATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0004'
    },
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic',
      PhysicalResourceId: 'test-topic',
      ResourceStatus: 'UPDATE_IN_PROGRESS',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0003'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'UPDATE_IN_PROGRESS',
      ResourceStatusReason: 'User Initiated',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0002'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'CREATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0001'
    }
  ]
]

const SampleStackEventsPerPollingRoundWithCleanup = [
  [
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'UPDATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0006'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'UPDATE_CLEANUP_IN_PROGRESS',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0005'
    },
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic',
      PhysicalResourceId: 'test-topic',
      ResourceStatus: 'UPDATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0004'
    },
    {
      ResourceType: 'AWS::SNS::Topic',
      LogicalResourceId: 'test-topic',
      PhysicalResourceId: 'test-topic',
      ResourceStatus: 'UPDATE_IN_PROGRESS',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0003'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'UPDATE_IN_PROGRESS',
      ResourceStatusReason: 'User Initiated',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0002'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'CREATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0001'
    }
  ]
]

const SampleStackEventsDeleteFailedState = [
  [
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'DELETE_FAILED',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0005'
    },
    {
      ResourceType: 'AWS::S3::Bucket',
      LogicalResourceId: 'Bucket',
      PhysicalResourceId: 'test-bucket-igivftgohq4l',
      ResourceStatus: 'DELETE_FAILED',
      ResourceStatusReason: 'Resource handler returned message: "The bucket you tried to delete is not empty (Service: S3, Status Code: 409, Request ID: J4BPF9MYZP36KZZH, Extended Request ID: 824TafEaWLY3RO8AbKUMQGxcAIZmL0++mj+YgjdOro7OBaqV2thjjJ7KJMub22CaQ/1yG+g6PYo=)" (RequestToken: 65009dd2-331d-4476-04b2-838fcc5930ec, HandlerErrorCode: GeneralServiceException)',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0004'
    },
    {
      ResourceType: 'AWS::S3::Bucket',
      LogicalResourceId: 'Bucket',
      PhysicalResourceId: 'test-bucket-igivftgohq4l',
      ResourceStatus: 'DELETE_IN_PROGRESS',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0003'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'DELETE_IN_PROGRESS',
      ResourceStatusReason: 'User Initiated',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0002'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: 'test-stack',
      PhysicalResourceId: 'test-stack-id',
      ResourceStatus: 'CREATE_COMPLETE',
      StackId: 'test-stack-id',
      StackName: 'test-stack',
      Timestamp: new Date(),
      EventId: '0001'
    }
  ]
]

/**
 * Mock DescribeStackEvents to yield certain events after each
 * polling round.
 *
 * @param {*} eventsAddedPerPollingRound
 * @returns
 */
function mockDescribeStackEvents (eventsAddedPerPollingRound) {
  let round = 0
  let nextEventIndex = 0
  let events = []
  return (args) => {
    if (!args.NextToken) {
      // Add events for the next round to current event history
      events = events.concat(eventsAddedPerPollingRound[round])

      // Sort them by EventId (largest id first, lowest id last)
      events = events.sort((a, b) => -a.EventId.localeCompare(b.EventId))

      // Prepare for next round
      round += 1

      // Start serving events from the top of the Events array
      nextEventIndex = 0
    }

    // Take two events from the events array for each page.
    const StackEvents = [
      events[nextEventIndex],
      events[nextEventIndex + 1]
    ].filter((e) => e)

    // Advance event pointer for possible request about the next page
    nextEventIndex += 2

    // Return events to caller. If there's still events for the next page, add NextToken
    // to the page. Otherwise return the events without Next Token
    const resp = events[nextEventIndex]
      ? { StackEvents, NextToken: `next=${nextEventIndex}` }
      : { StackEvents }
    return resp
  }
}

/**
 * Sample events for stack that is being deleted.
 *
 * @param {string} stackid ARN of the stack that is being deleted
 * @param {string} stackname Name of the stack that is being deleted
 * @returns
 */
function deleteStackEvents (stackid, stackname) {
  return [[
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: stackname,
      PhysicalResourceId: stackid,
      ResourceStatus: 'DELETE_COMPLETE',
      StackId: stackid,
      StackName: stackname,
      Timestamp: new Date(),
      EventId: '0002'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: stackname,
      PhysicalResourceId: stackid,
      ResourceStatus: 'DELETE_IN_PROGRESS',
      ResourceStatusReason: 'User Initiated',
      StackId: stackid,
      StackName: stackname,
      Timestamp: new Date(),
      EventId: '0001'
    }
  ]]
}

/**
 * Sample events for stack that is being updated.
 *
 * @param {string} stackid ARN of the stack that is being updated
 * @param {string} stackname Name of the stack that is being updated
 * @returns
 */
function updateStackEvents (stackid, stackname) {
  return [[
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: stackname,
      PhysicalResourceId: stackid,
      ResourceStatus: 'UPDATE_COMPLETE',
      StackId: stackid,
      StackName: stackname,
      Timestamp: new Date(),
      EventId: '0002'
    },
    {
      ResourceType: 'AWS::CloudFormation::Stack',
      LogicalResourceId: stackname,
      PhysicalResourceId: stackid,
      ResourceStatus: 'UPDATE_IN_PROGRESS',
      ResourceStatusReason: 'User Initiated',
      StackId: stackid,
      StackName: stackname,
      Timestamp: new Date(),
      EventId: '0001'
    }
  ]]
}

export default {
  mockDescribeStackEvents,
  SampleStackEventsPerPollingRound,
  SampleStackEventsPerPollingRoundSimple,
  SampleStackEventsPerPollingRoundWithCleanup,
  SampleStackEventsDeleteFailedState,
  deleteStackEvents,
  updateStackEvents
}
