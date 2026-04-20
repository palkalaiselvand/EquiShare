# Security Specification for EquiShare

## Data Invariants
1. A user profile is keyed by their verified email address.
2. A group must have at least one member (the creator).
3. Access to expenses is strictly coupled with group membership.
4. Total splits in an expense must equal the total amount (validated in app, rules check for split presence).
5. Identity fields (paidBy, createdBy) are immutable.

## The Dirty Dozen Payloads (Deny)
1. Creating a user profile for a different email than the authenticated user.
2. Updating a user profile that doesn't belong to the authenticated user.
3. Reading group expenses when not a member of the group.
4. Creating a group without being listed in the `members` array.
5. Removing oneself from a group if they are the only member (though status locking is better).
6. Adding a "paidBy" email in an expense that doesn't match a group member.
7. Modifying the `amount` of an expense without being the original payer (identity-based locking).
8. Injecting a 2MB string into the group name (size enforcement).
9. spoofing `createdBy` in a group to be someone else.
10. Listing all users in the system without authentication.
11. Deleting an expense created by someone else if the rule is "only payer can delete".
12. Updating the `createdAt` timestamp.

## Red Team Checklist
- [ ] Identity Spoofing (ownerId checks)
- [ ] Orphaned Writes (parent existence checks)
- [ ] Size Enforcements (.size() < 1000)
- [ ] Atomic Splits (via schema validation)
