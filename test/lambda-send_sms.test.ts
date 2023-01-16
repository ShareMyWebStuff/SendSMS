import { SQSEvent } from "aws-lambda";
import { main } from "../src/send-sms/send-sms";
import { mock, restore } from "aws-sdk-mock";

describe("Check the lambda function for failure", () => {
  let sqsEvent: SQSEvent;

  beforeEach(() => {
    /**
     * Setup dummy sqs event
     */
    sqsEvent = {
      Records: [
        {
          messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
          receiptHandle: "MessageReceiptHandle",
          body: JSON.stringify({}),
          attributes: {
            ApproximateReceiveCount: "1",
            SentTimestamp: "1523232000000",
            SenderId: "123456789012",
            ApproximateFirstReceiveTimestamp: "1523232000001",
          },
          messageAttributes: {},
          md5OfBody: "7b270e59b47ff90a553787216d55d91d",
          eventSource: "aws:sqs",
          eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
          awsRegion: "us-east-1",
        },
      ],
    };
  });

  /**
   * Start tests
   */
  test("Should throw error if SQS event is empty array ", async () => {
    const sqsEvt: SQSEvent = { Records: [] };
    await expect(main(sqsEvt)).rejects.toThrow(
      "Please enter a valid mobile number and message"
    );
  });

  test("Should throw error if the SQS event body is not object", async () => {
    sqsEvent.Records[0].body = JSON.stringify(null);
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a valid mobile number and message"
    );
  });

  test("Should throw error if the SQS event body contains no phoneNumber or message", async () => {
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a valid mobile number and message"
    );
  });

  test("Should throw error if the SQS event body contains no phoneNumber", async () => {
    sqsEvent.Records[0].body = JSON.stringify({ Message: JSON.stringify({}) });
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a valid mobile number"
    );
  });

  test("Should throw error if the SQS event body contains invalid phoneNumber", async () => {
    sqsEvent.Records[0].body = JSON.stringify({
      Message: JSON.stringify({ phoneNumber: "ABCDEFGHIJK" }),
    });
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a valid mobile number"
    );
  });

  test("Should throw error if the SQS event body contains invalid phoneNumber", async () => {
    sqsEvent.Records[0].body = JSON.stringify({
      Message: JSON.stringify({ phoneNumber: "ABCDEFGHIJK" }),
    });
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a valid mobile number"
    );
  });

  test("Should throw error if the SQS event body contains invalid message", async () => {
    sqsEvent.Records[0].body = JSON.stringify({
      Message: JSON.stringify({ phoneNumber: "+447973631360" }),
    });
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a message between 5 - 200 characters"
    );
  });

  test("Should throw error if the SQS event body contains message too short", async () => {
    sqsEvent.Records[0].body = JSON.stringify({
      Message: JSON.stringify({ phoneNumber: "+447973631360", message: "ABC" }),
    });
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a message between 5 - 200 characters"
    );
  });

  test("Should throw error if the SQS event body contains message too long", async () => {
    sqsEvent.Records[0].body = JSON.stringify({
      Message: JSON.stringify({
        phoneNumber: "+447973631360",
        message: "a".repeat(300),
      }),
    });
    await expect(main(sqsEvent)).rejects.toThrow(
      "Please enter a message between 5 - 200 characters"
    );
  });

  test("Should successful mock sns publish error in the lambda function", async () => {
    /**
     * Set the mobile SMS details
     */
    sqsEvent.Records[0].body = JSON.stringify({
      Message: JSON.stringify({
        phoneNumber: "+447973631360",
        message: "Thank you for using our service.",
      }),
    });
    mock("SNS", "publish", Promise.reject("Serious error."));

    await expect(main(sqsEvent)).rejects.toThrow(
      "Error sending message, please try again."
    );
    restore("SNS", "publish");
  });

  test("Should successful mock sending the message", async () => {
    /**
     * Set the mobile SMS details
     */
    sqsEvent.Records[0].body = JSON.stringify({
      Message: JSON.stringify({
        phoneNumber: "+447973631360",
        message: "Thank you for using our service.",
      }),
    });

    /**
     * Setup the mock for the SNS topic in main
     */
    mock("SNS", "publish", Promise.resolve("All okay."));
    const res = await main(sqsEvent);

    expect(res).toBe("All okay.");

    restore("SNS", "publish");
  });
});
