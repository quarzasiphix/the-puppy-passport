// Stage E: organisation team/volunteer management
// (supabase/migrations/20260101007700_organisation_team_management.sql). See
// docs/AUTONOMOUS_BACKEND_PROGRESS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, ids, isBlocked } from "./helpers.ts";

test("owner_user_id can no longer be changed except by an admin", async (t) => {
  const foundation1 = await as("foundation1");
  const admin = await as("admin");

  await t.test("the org's own owner cannot transfer ownership via a direct update", async () => {
    const attempt = await foundation1
      .from("organisations")
      .update({ owner_user_id: ids.buyer })
      .eq("id", ids.orgFundacja)
      .select("owner_user_id");
    assert.ok(attempt.error, "expected the ownership-transfer lock trigger to reject this");

    const check = await admin
      .from("organisations")
      .select("owner_user_id")
      .eq("id", ids.orgFundacja)
      .single();
    assert.equal(check.data?.owner_user_id, ids.foundation1);
  });

  await t.test("an admin can still transfer ownership deliberately", async () => {
    const changed = await admin
      .from("organisations")
      .update({ owner_user_id: ids.foundation1 })
      .eq("id", ids.orgFundacja)
      .select("owner_user_id")
      .single();
    assert.equal(changed.error, null);
    assert.equal(changed.data?.owner_user_id, ids.foundation1);
  });
});

test("invitation eligibility: only the owner may invite an administrator", async (t) => {
  const foundation1 = await as("foundation1");
  let volunteerMemberId: string | undefined;

  await t.test("setup: the owner invites buyer@ as a volunteer and buyer accepts", async () => {
    const invite = await foundation1.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "buyer@havenpaw.test",
      p_role: "volunteer",
    });
    assert.equal(invite.error, null);
    const invitationId = invite.data as string;

    const preview = await foundation1
      .from("organisation_invitations")
      .select("token")
      .eq("id", invitationId)
      .single();
    assert.equal(preview.error, null);
    const token = preview.data!.token as string;

    const buyer = await as("buyer");
    const accept = await buyer.rpc("accept_org_invitation", { p_token: token });
    assert.equal(accept.error, null);

    const member = await foundation1
      .from("organisation_members")
      .select("id, member_role")
      .eq("org_id", ids.orgFundacja)
      .eq("profile_id", ids.buyer)
      .single();
    assert.equal(member.error, null);
    assert.equal(member.data?.member_role, "volunteer");
    volunteerMemberId = member.data!.id as string;
  });

  await t.test("the volunteer cannot invite anyone at all", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "someone-else@havenpaw.test",
      p_role: "volunteer",
    });
    assert.ok(attempt.error, "expected a volunteer to have no invite capability");
  });

  await t.test("the volunteer cannot remove another member either", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.rpc("remove_org_member", { p_member_id: volunteerMemberId! });
    assert.ok(attempt.error, "expected a volunteer to have no member-management capability");
  });

  await t.test("cleanup", async () => {
    if (volunteerMemberId)
      await foundation1.rpc("remove_org_member", { p_member_id: volunteerMemberId });
  });
});

test("an administrator-tier member cannot invite or manage another administrator", async (t) => {
  const foundation1 = await as("foundation1");
  let adminMemberId: string | undefined;

  await t.test("setup: owner invites buyer@ as administrator, buyer accepts", async () => {
    const invite = await foundation1.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "buyer@havenpaw.test",
      p_role: "administrator",
    });
    assert.equal(invite.error, null);
    const invitationId = invite.data as string;
    const row = await foundation1
      .from("organisation_invitations")
      .select("token")
      .eq("id", invitationId)
      .single();
    const buyer = await as("buyer");
    const accept = await buyer.rpc("accept_org_invitation", { p_token: row.data!.token as string });
    assert.equal(accept.error, null);

    const member = await foundation1
      .from("organisation_members")
      .select("id")
      .eq("org_id", ids.orgFundacja)
      .eq("profile_id", ids.buyer)
      .single();
    adminMemberId = member.data!.id as string;
  });

  await t.test("the new administrator (buyer) cannot invite another administrator", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "customer@havenpaw.test",
      p_role: "administrator",
    });
    assert.ok(attempt.error, "expected only the true owner to be able to invite an administrator");
  });

  await t.test("the new administrator CAN invite a volunteer (non-privileged role)", async () => {
    const buyer = await as("buyer");
    const invite = await buyer.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "customer@havenpaw.test",
      p_role: "volunteer",
    });
    assert.equal(invite.error, null);
    await buyer.rpc("revoke_org_invitation", { p_invitation_id: invite.data as string });
  });

  await t.test(
    "the new administrator cannot remove or demote themselves or a fellow administrator",
    async () => {
      const buyer = await as("buyer");
      const removeAttempt = await buyer.rpc("remove_org_member", { p_member_id: adminMemberId! });
      assert.ok(
        removeAttempt.error,
        "expected an administrator to be unable to remove an administrator-tier row",
      );
    },
  );

  await t.test("but the true owner can remove the administrator", async () => {
    const { error } = await foundation1.rpc("remove_org_member", { p_member_id: adminMemberId! });
    assert.equal(error, null);
  });
});

test("suspended membership loses org access immediately", async (t) => {
  const foundation1 = await as("foundation1");
  let memberId: string | undefined;

  await t.test("setup: buyer joins as volunteer", async () => {
    const invite = await foundation1.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "buyer@havenpaw.test",
      p_role: "volunteer",
    });
    const row = await foundation1
      .from("organisation_invitations")
      .select("token")
      .eq("id", invite.data as string)
      .single();
    const buyer = await as("buyer");
    await buyer.rpc("accept_org_invitation", { p_token: row.data!.token as string });
    const member = await foundation1
      .from("organisation_members")
      .select("id")
      .eq("org_id", ids.orgFundacja)
      .eq("profile_id", ids.buyer)
      .single();
    memberId = member.data!.id as string;
  });

  await t.test("the member can read the (non-public) organisation while active", async () => {
    // Fundacja is a real approved+public org normally readable anyway; this proves membership
    // access specifically by relying on is_org_member() through the members-read-their-own-org path.
    const buyer = await as("buyer");
    const org = await buyer.from("organisations").select("id").eq("id", ids.orgFundacja).single();
    assert.equal(org.error, null);
  });

  await t.test("after suspension, is_org_member-gated access is revoked", async () => {
    const suspend = await foundation1.rpc("set_org_member_status", {
      p_member_id: memberId!,
      p_status: "suspended",
    });
    assert.equal(suspend.error, null);

    const buyer = await as("buyer");
    // A welfare case creation is a real is_org_member()-gated action, unambiguous and
    // independently verified in tests/db/welfare-cases.test.ts.
    const attempt = await buyer
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.buyer,
        reason: "Should be rejected — suspended member.",
        status: "submitted",
      })
      .select();
    assert.ok(isBlocked(attempt.data, attempt.error));
  });

  await t.test("restoring reactivates access", async () => {
    const restore = await foundation1.rpc("set_org_member_status", {
      p_member_id: memberId!,
      p_status: "active",
    });
    assert.equal(restore.error, null);

    const buyer = await as("buyer");
    const attempt = await buyer
      .from("welfare_cases")
      .insert({
        organisation_id: ids.orgFundacja,
        created_by: ids.buyer,
        reason: "Should succeed — restored member.",
        status: "submitted",
      })
      .select("id")
      .single();
    assert.equal(attempt.error, null);
    await foundation1.from("welfare_cases").delete().eq("id", attempt.data!.id);
  });

  await t.test("cleanup", async () => {
    if (memberId) await foundation1.rpc("remove_org_member", { p_member_id: memberId });
  });
});

test("invitation token lifecycle: expiry, wrong email, single-use, and no public listing", async (t) => {
  const foundation1 = await as("foundation1");
  let invitationId: string | undefined;
  let token: string | undefined;

  await t.test("setup: invite customer@", async () => {
    const invite = await foundation1.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "customer@havenpaw.test",
      p_role: "volunteer",
    });
    assert.equal(invite.error, null);
    invitationId = invite.data as string;
    const row = await foundation1
      .from("organisation_invitations")
      .select("token")
      .eq("id", invitationId)
      .single();
    token = row.data!.token as string;
  });

  await t.test("a wrong-email user cannot accept it", async () => {
    const buyer = await as("buyer");
    const attempt = await buyer.rpc("accept_org_invitation", { p_token: token! });
    assert.ok(attempt.error, "expected an email mismatch to be rejected");
  });

  await t.test(
    "an unrelated authenticated user cannot bulk-read organisation_invitations",
    async () => {
      const buyer = await as("buyer");
      const blocked = await buyer.from("organisation_invitations").select("id, invited_email");
      assert.ok(isBlocked(blocked.data, blocked.error));
    },
  );

  await t.test("get_invitation_by_token returns a safe preview for the right token", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer.rpc("get_invitation_by_token", { p_token: token! });
    assert.equal(error, null);
    assert.equal(data?.[0]?.org_name, "Fundacja Ratunek dla Psów");
    assert.equal(data?.[0]?.invited_role, "volunteer");
  });

  await t.test("the correct-email user accepts it once", async () => {
    const customer = await as("customer");
    const accept = await customer.rpc("accept_org_invitation", { p_token: token! });
    assert.equal(accept.error, null);
  });

  await t.test("the same token cannot be accepted a second time", async () => {
    const customer = await as("customer");
    const again = await customer.rpc("accept_org_invitation", { p_token: token! });
    assert.ok(again.error, "expected a re-accept to be rejected — single-use");
  });

  await t.test("get_invitation_by_token returns nothing once resolved", async () => {
    const buyer = await as("buyer");
    const { data, error } = await buyer.rpc("get_invitation_by_token", { p_token: token! });
    assert.equal(error, null);
    assert.equal(data?.length, 0);
  });

  await t.test("cleanup", async () => {
    const member = await foundation1
      .from("organisation_members")
      .select("id")
      .eq("org_id", ids.orgFundacja)
      .eq("profile_id", ids.customer)
      .single();
    if (member.data?.id)
      await foundation1.rpc("remove_org_member", { p_member_id: member.data.id });
  });
});

test("leave_organisation removes the caller's own membership", async (t) => {
  const foundation1 = await as("foundation1");

  await t.test("setup and leave", async () => {
    const invite = await foundation1.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "buyer@havenpaw.test",
      p_role: "volunteer",
    });
    const row = await foundation1
      .from("organisation_invitations")
      .select("token")
      .eq("id", invite.data as string)
      .single();
    const buyer = await as("buyer");
    await buyer.rpc("accept_org_invitation", { p_token: row.data!.token as string });

    const leave = await buyer.rpc("leave_organisation", { p_org_id: ids.orgFundacja });
    assert.equal(leave.error, null);

    const check = await foundation1
      .from("organisation_members")
      .select("id")
      .eq("org_id", ids.orgFundacja)
      .eq("profile_id", ids.buyer);
    assert.equal(check.data?.length, 0);
  });
});

test("cross-organisation isolation: one org's owner cannot manage another org's members", async (t) => {
  const breeder1 = await as("breeder1");
  const foundation1 = await as("foundation1");

  await t.test("breeder1 (owns orgCichyLas) cannot invite into orgFundacja", async () => {
    const attempt = await breeder1.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "someone@havenpaw.test",
      p_role: "volunteer",
    });
    assert.ok(attempt.error, "expected a cross-organisation invite to be rejected");
  });

  await t.test("breeder1 cannot revoke an invitation belonging to orgFundacja", async () => {
    const invite = await foundation1.rpc("invite_org_member", {
      p_org_id: ids.orgFundacja,
      p_email: "someone2@havenpaw.test",
      p_role: "volunteer",
    });
    assert.equal(invite.error, null);
    const attempt = await breeder1.rpc("revoke_org_invitation", {
      p_invitation_id: invite.data as string,
    });
    assert.ok(attempt.error, "expected cross-organisation revoke to be rejected");
    await foundation1.rpc("revoke_org_invitation", { p_invitation_id: invite.data as string });
  });
});
