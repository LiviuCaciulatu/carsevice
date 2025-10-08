declare module "@aws-sdk/client-textract" {
  // Minimal ambient types for the Textract client used in this project.
  export class TextractClient {
    constructor(opts: any);
    send(command: any): Promise<any>;
  }

  export class DetectDocumentTextCommand {
    constructor(input: any);
  }

  export {};
}
