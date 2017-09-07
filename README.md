A tool for monitoring the progress of AWS CloudFormation stack events during
the creation or update of a stack.

## Usage

To start monitoring the events of a stack, just pipe the output of the awscli
`create-stack` or `update-stack` command to the `cfn-monitor` tool:

```bash
aws cloudformation create-stack [...] | cfn-monitor
aws cloudformation update-stack [...] | cfn-monitor
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

## Ideas
* Exit value to reflect the result of the operation (success / failure)
* Support for providing the stack name as argument to support monitoring stack deletion
