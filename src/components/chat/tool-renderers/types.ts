export type ToolPartState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export type ToolPart = {
  type: string;
  toolCallId: string;
  state?: ToolPartState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  /** Server-side replay (content-to-ui-parts) writes the approval id here. */
  approvalId?: string;
  /** AI SDK client-side streaming puts the approval id under `approval.id`.
   *  Keep both shapes on the type and normalize via `getApprovalId(part)`. */
  approval?: {
    id?: string;
    approved?: boolean;
    reason?: string;
  };
};

/** Read the approval id from either the server-replay shape (`approvalId`)
 *  or the live-streaming shape (`approval.id`). Renderers should always
 *  go through this helper — reading `part.approvalId` directly misses
 *  the streaming case and makes the approval pill look stale. */
export function getApprovalId(part: ToolPart): string | undefined {
  return part.approvalId ?? part.approval?.id;
}

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
