import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_iam as iam } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as path from "path";

/**
 * SendSmsStack - creates the infrastructure for this project
 *
 * apigateway   REST API  Contains a POST route (/send-sms) that accepts a phoneNumber and message.
 * api-topic    SNS       Takes the apigateway message and pushes it to queue
 * lambda-queue SQS       The api-topic messages are stored in this queue until they can be processed
 * lambda       Lambda    The lambda function validates the message, if the phone number and message are valid then the message is forwarded to the SNS topic to send a
 *
 */
export class SendSmsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create SNS topic for notifications
     */
    const apigateTopic = new sns.Topic(this, "api-topic", {
      displayName: "api-topic",
      topicName: "api-topic",
    });

    /**
     * Create lambda queue
     */
    const lambdaQueue = new sqs.Queue(this, "lambda-queue", {
      queueName: "lambda-queue",
    });

    /**
     * The queue subscribes to Apigateway SNS
     */
    apigateTopic.addSubscription(new subs.SqsSubscription(lambdaQueue));

    /**
     * Create the Rest api
     */
    const smsApi = new apigateway.RestApi(this, "sms-api", {
      description: "sms-apigateway",
      deployOptions: {
        stageName: "dev",
      },
      // 👇 enable CORS
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type"],
        allowMethods: ["OPTIONS", "POST"],
        allowCredentials: true,
        allowOrigins: ["http://localhost:3000"],
      },
    });

    /**
     * Add the routes for the API
     *
     * Create the  send-sms route
     */
    const sendSMS = smsApi.root.addResource("send-sms");

    /**
     * Create service role for api gateway to publish notifications
     */
    const gatewayExecutionRole: any = new iam.Role(
      this,
      "GatewayExecutionRole",
      {
        assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
        inlinePolicies: {
          PublishMessagePolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ["sns:Publish"],
                resources: [apigateTopic.topicArn],
              }),
            ],
          }),
        },
      }
    );

    /**
     * Add the methods for the send-sms route.
     * POST - adds message to sns
     */
    sendSMS.addMethod(
      "POST",
      new apigateway.AwsIntegration({
        service: "sns",
        integrationHttpMethod: "POST",
        path: `${process.env.CDK_DEFAULT_ACCOUNT}/${apigateTopic.topicName}`,
        options: {
          credentialsRole: gatewayExecutionRole,
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          requestParameters: {
            "integration.request.header.Content-Type": `'application/x-www-form-urlencoded'`,
          },
          requestTemplates: {
            "application/json": `Action=Publish&TopicArn=$util.urlEncode('${apigateTopic.topicArn}')&Message=$util.urlEncode($input.body)`,
          },
          integrationResponses: [
            {
              statusCode: "200",
              responseTemplates: {
                "application/json": `{"status": "message successfully added to topic"}`,
              },
            },
            {
              statusCode: "400",
              selectionPattern: "^[Error].*",
              responseTemplates: {
                "application/json": `{"state":"error","message":"$util.escapeJavaScript($input.path('$.errorMessage'))"}`,
              },
            },
          ],
        },
      }),
      { methodResponses: [{ statusCode: "200" }, { statusCode: "400" }] }
    );

    /**
     * Create SNS topic for SMS messages
     */
    const smsTopic = new sns.Topic(this, "sms-topic", {
      displayName: "sms-topic",
      topicName: "sms-topic",
    });

    /**
     * Create the sms sns policy statement
     */
    const snsTopicPolicy = new iam.PolicyStatement({
      actions: ["sns:publish"],
      resources: ["*"],
    });

    /**
     * Create lambda function - if returns success the success message is published to the sms-topic
     */
    const myLambda = new NodejsFunction(this, "lambdaSendMessage", {
      functionName: "sendMessage",
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "main",
      entry: path.join(__dirname, `/../src/send-sms/send-sms.ts`),
      onSuccess: new cdk.aws_lambda_destinations.SnsDestination(smsTopic),
    });

    /**
     * add sqs queue as event source for lambda - we only get 1 item at a time
     */
    myLambda.addEventSource(
      new SqsEventSource(lambdaQueue, {
        batchSize: 1,
      })
    );

    /**
     * Add the service role to the lambda function
     */
    myLambda.addToRolePolicy(snsTopicPolicy);

    /**
     * Stack outputs - only the api gateway route is required
     */
    new cdk.CfnOutput(this, "sms-api-url", {
      value: smsApi.url,
      exportName: "sms-api-url",
    });
  }
}
