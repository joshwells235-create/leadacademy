export type ToolPartState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "output-available"
  | "output-error";

export type ToolPart = {
  type: string;
  toolCallId: string;
  state?: ToolPartState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approvalId?: string;
};

export type ApprovalHandler = (approvalId: string, approved: boolean) => void | Promise<void>;

export type ToolRendererProps = {
  part: ToolPart;
  /**
   * Is this the most recent message in the transcript? Approval pills for
   * older messages that were never resolved should render as inert.
   */
  isLatestMessage: boolean;
  onApproval: ApprovalHandler;
};
