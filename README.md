A tool for monitoring the progress of AWS CloudFormation stack events during
the creation or update of a stack.

## Usage

To start monitoring the events of a stack, just pipe the output of the awscli
`create-stack`, `update-stack`, `delete-stack` or `cloudformation deploy` command
to `cfn-monitor`:

```bash
aws cloudformation create-stack [...] | cfn-monitor
aws cloudformation update-stack [...] | cfn-monitor
aws cloudformation delete-stack [...] | cfn-monitor
aws cloudformation deploy [...] | cfn-monitor
```

Alternatively, you can provide one or more CloudFormation stack ARNs as command line arguments:
```bash
cfn-monitor \
    arn:aws:cloudformation:eu-west-1:123456789123:stack/sample/f3e822e2-1204-4805-ac46-f06fb9f90c67 \
    arn:aws:cloudformation:eu-west-1:123456789123:stack/another/2cb70a0f-377e-4aff-ae7a-a27ebf725e1a
```

You can also combine them both to see updates from multiple stacks:
```bash
aws cloudformation create-stack [...] | cfn-monitor \
    arn:aws:cloudformation:eu-west-1:123456789123:stack/sample/f3e822e2-1204-4805-ac46-f06fb9f90c67 \
```

Finally, you can call `cfn-monitor` without any input or arguments to start monitoring
all stacks that have active operations:
```bash
cfn-monitor
```

### Example
```
$ aws cloudformation create-stack --stack-name data-bucket --template-body file://data-bucket-stack.yaml | cfn-monitor
data-bucket 2017-07-08T17:22:46.196Z CREATE_IN_PROGRESS AWS::CloudFormation::Stack data-bucket  (Reason: User Initiated)
data-bucket 2017-07-08T17:22:49.934Z CREATE_IN_PROGRESS AWS::S3::Bucket DataBucket
data-bucket 2017-07-08T17:22:51.748Z CREATE_IN_PROGRESS AWS::S3::Bucket DataBucket  (Reason: Resource creation Initiated)
data-bucket 2017-07-08T17:23:12.640Z CREATE_COMPLETE AWS::S3::Bucket DataBucket
data-bucket 2017-07-08T17:23:16.317Z CREATE_COMPLETE AWS::CloudFormation::Stack data-bucket
```

![Demo GIF](https://sjakthol.github.io/cfn-monitor-demo.gif)

## Ideas
* Exit value to reflect the result of the operation (success / failure)
