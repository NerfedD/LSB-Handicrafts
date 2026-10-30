import { downloadCsv } from "./csv";

/** "Export users as CSV" (command menu and User Management): the accounts already loaded. */
export function exportUsers(staff) {
  downloadCsv(
    "lsb-users.csv",
    [
      { label: "Name", value: (row) => row.name },
      { label: "Email", value: (row) => row.email },
      { label: "Role", value: (row) => row.role },
      { label: "Status", value: (row) => row.status },
      { label: "Phone", value: (row) => row.contactNumber },
    ],
    staff
  );
}
