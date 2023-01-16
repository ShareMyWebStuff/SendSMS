import { SQSEvent } from "aws-lambda";
import { SNS } from "aws-sdk";

/**
 * Lambda handler
 *
 * @param event
 */
export const main = async (event: SQSEvent) => {
  const sns = new SNS();

  /**
   * Check for item in the queue
   */
  if (event.Records.length !== 1) {
    throw new Error("Please enter a valid mobile number and message");
  }

  /**
   * Validate the message
   */
  const body = JSON.parse(event.Records[0].body);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Please enter a valid mobile number and message");
  }

  /**
   * Check the body has a message structure
   */
  if (!body.Message) {
    throw new Error("Please enter a valid mobile number and message");
  }

  /**
   * Validate the phone number
   */
  const { phoneNumber, message } = JSON.parse(body.Message);
  if (
    typeof phoneNumber !== "string" ||
    !/^\+[1-9]\d{10,14}$/.test(phoneNumber)
  ) {
    throw new Error("Please enter a valid mobile number");
  }

  /**
   * Validate the message
   */
  if (
    typeof message !== "string" ||
    message.length < 5 ||
    message.length > 200
  ) {
    throw new Error("Please enter a message between 5 - 200 characters");
  }

  /**
   * Message and number are valid, so publish to the SNS.
   */
  try {
    return await sns
      .publish({ PhoneNumber: phoneNumber, Message: message })
      .promise();
  } catch (err) {
    throw new Error("Error sending message, please try again.");
  }
};
