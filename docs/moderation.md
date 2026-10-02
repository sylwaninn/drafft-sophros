# Moderation decisions and sensitive reads

What the dashboard asks for before a decision or a sensitive read, and what the database checks again.

## Deleting an account at the member's request

Admins only. The website tells members to write to support from the account's email address, or from
another address giving its phone number, and the team asks them to confirm it's them. In sophros: the
account's ⋯ menu, or "Delete this account at their request" on a support request (its reference prefilled;
not shown for an account deleted already). The dialog says first whether the account will be erased or kept
for members' safety (banned, held or under an open report) and where the confirmation goes (the account's
email, and the request's address when it differs); it needs a reason and the request's reference
(`DR-XXXXXX`, or `email` for a message outside the support requests, never prefilled from the menu). When the
account is deleted already, a deletion is on its way, or the preview fails, the menu item is disabled with the
reason.

The backend deletes it exactly as the app's own deletion would, deciding again at that moment, writes
`account.delete` to the audit log and emails the confirmation, or tells the team when there's no address
(`admin_account_deletion_preview`, `admin_delete_account`). Timing and what is erased or kept: drafft-backend
`docs/privacy.md`, "Deleting an account without the app".

## Sensitive reads are logged

Opening an account (`user.view`), a selfie (`selfie.view`) or a conversation (`conversation.view`, on both
accounts, with where it was opened from) is written to the audit log. Selfies and conversations open only for
a reason the person types (see [Reading a conversation](#reading-a-conversation) and
[Viewing a selfie](#viewing-a-selfie)). Each account page shows its staff trail.

## Reasons and access

Backend side: drafft-backend migration `20260930000401_moderation_reasons_and_chat_access`, and its
`docs/moderation.md`.

**Decisions the member is told about** (DSA art. 17 statement of reasons): putting or changing a hold
(review, selfie, ban), refusing a profile photo, deleting a chat message. Every form that makes one asks
for three things:

| Field           | Posted as  | Goes to                                                                                                                                                          |
| --------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reason told     | `category` | the member, by email and push in their language, with the part of the terms it falls under; required, from `admin_reason_categories` (loaded by the root loader) |
| Note for them   | `details`  | the member, sent as written (not translated), 1,000 characters at most; optional                                                                                 |
| Internal reason | `reason`   | the audit and moderation logs only                                                                                                                               |

`/act` refuses such a decision without a category, with one `admin_reason_categories` doesn't list, or with a
note over 1,000 characters, before calling the database; the database checks all three again
(`category_required`, `invalid_category`, `details_too_long`: nothing applied). The forms don't confirm until
the category is one the database listed, so a preselected one can't slip through when the list couldn't be
read. A refusal keeps the dialog open with what was typed. A hold the account already has isn't offered
(nothing would be recorded, nor told).

Where the decision itself says why, the category is preselected and can be changed: a selfie request
(`identity_check`), a refused photo (`photo_guidelines`); never for a ban. Staff labels and the links to
getdrafft.com/terms (from each category's `termsAnchor`) are in `app/lib/reasons.ts`.

Decisions that tell the member nothing ask only for the internal reason: lifting a hold (they're emailed that
they're back), approving a photo, keeping an automatic refusal (they were told then), marking a flagged chat
photo as fine, closing a report without a hold.

| Decision                                      | Function                                                |
| --------------------------------------------- | ------------------------------------------------------- |
| Restrict, ask for a selfie again, ban         | `admin_set_hold`                                        |
| Refuse a photo (account page, Profile photos) | `admin_review_media`                                    |
| Refuse and hold or ban (Profile photos)       | `admin_decide_photo`                                    |
| Hold, selfie or ban from a chat photo         | `admin_decide_flags`                                    |
| Close a report with a hold                    | `admin_close_report`                                    |
| Delete a message (conversation drawer)        | `admin_log('message.delete')`, author told once removed |

## Reading a conversation

The drawer first asks `admin_conversation_access` (nothing read, nothing logged) and shows the basis the
database finds: a report between the two, a help request from either (open or from the last 90 days), either
account on hold or banned by someone other than the reader. The messages load only once the person
types why (`conversation-data` action, posted so the reason stays out of URLs); the reading is logged on
both accounts with that reason and where it was opened from (the reason is cut so the whole fits the audit
log's 1,000 characters; the drawer takes 785). Without a basis, a moderator can't read it (`no_basis`); an
admin can, as an override confirmed in a second dialog that asks why (`p_override_basis`: a legal request or
members' safety, else `override_basis_required`) and logged as one. A refused reading keeps the reason typed,
and `no_basis` reloads the basis shown. Deleting a message needs the same basis or override, checked again
by the database. A reason is always required (`reason_required`); the placeholder "opened in sophros" is
refused.

## Viewing a selfie

Verifications never signs a selfie in its loader: each case shows a field to say why, and `selfie-data` logs the viewing (`admin_selfies`, reason required) and returns a 5-minute
link. A Storage failure says so (and can be tried again); only a case without any file says the selfie is
missing.

## Data and privacy

sophros stores nothing itself. Device reports (model, OS and app version, locale, time zone, IP, country) come
from the apps' `report_app_open` and are pruned by the database: IPs 180 days after the last open from that
address, devices a year after their last open (drafft-backend `docs/privacy.md`). The privacy policy must say
so, and that staff may read conversations only on the database's basis: a report between the two, a help
request from either, a hold on either; otherwise an admin's override for a legal request or members' safety,
logged as one.
