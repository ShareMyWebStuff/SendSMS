# SendSMS

This project creates the AWS infrastructure to enable a person to send a text message to a mobile phone from an api route.

The infrastructure is created as code using AWS CDK and tested using Jest.

The following has been created

API Gateway - POST /send-sms to forward a message to a SNS Topic
SNS Topic - Take the api messages quickly to a more persistent queue
SQS - Persists the messages and waits for a lambda function to pull the messages off the queue. This decouples the message processing from where they are received.
Lambda - This function validates the message sent and if okay pushes it the the SNS topic to send an SMS
SNS - Sends an SMS

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## Testing

Two sets of tests have been created

- Test the cdk populates the template with the services we expect
- Testing of the lambda function, including mocking the SNS for success and failure

Below you can see a test coverage of 100% was achieved
