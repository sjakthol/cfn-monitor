A tool for monitoring the progress of AWS CloudFormation stack events during
the creation or update of a stack.

## Usage

To start monitoring the events of a stack, just pipe the output of the awscli
`create-stack` or `update-stack` command to the `cfn-monitor` tool:

```bash
aws cloudformation create-stack [...] | cfn-monitor
aws cloudformation update-stack [...] | cfn-monitor
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

### Monitoring delete-stack Operations

In order to monitor `delete-stack` operations, you will need to define the AWS region to use
in the `AWS_REGION` environmental variable. The tool starts to monitor stack deletion if the
input provided to it (stdin or args) does not provide any stack ARNs. Since the `delete-stack`
command does not output the stack it's operating on, you might need to choose the stack you
want to monitor. If there's only one stack being deleted, the tool chooses that one automatically.

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
