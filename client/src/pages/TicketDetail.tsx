import React from "react";
import { useAuth } from "../context/AuthContext.js";
import { UserRole } from "../api.js";
//import { ActionsTakenSection } from "../components/actions-taken/ActionsTakenSection.js";
import { StaffTicketDetail } from "./StaffTicketDetail.js";
import { TicketDetailView } from "../components/TicketDetailView.js";

export interface TicketDetailProps {
  ticketId: string;
  userRole?: UserRole;
  onBack?: () => void;
}

/**
 * Unified TicketDetail Page Component (Lab 4 Issue 4).
 * 
 * Integrates Actions Taken according to user role:
 * - IT_STAFF & ADMINISTRATOR: Show operational detail with ActionTakenForm + ActionsTakenList (with edit buttons).
 * - REQUESTER: Show TicketDetailView with ActionsTakenList in Read-Only mode (hide form and edit controls).
 */
export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticketId,
  userRole,
  onBack,
}) => {
  let role: UserRole = userRole || "REQUESTER";

  try {
    const auth = useAuth();
    if (!userRole && auth?.user?.role) {
      role = auth.user.role;
    }
  } catch {
    // In case rendered outside AuthProvider without userRole prop
    if (userRole) {
      role = userRole;
    }
  }

  if (role === "IT_STAFF" || role === "ADMINISTRATOR") {
    return (
      <div data-testid="ticket-detail-staff">
        <StaffTicketDetail ticketId={ticketId} onBackToQueue={onBack || (() => { })} />
      </div>
    );
  }

  return (
    <div data-testid="ticket-detail-requester">
      <TicketDetailView ticketId={ticketId} onBackToTickets={onBack} />
    </div>
  );
};

export default TicketDetail;
