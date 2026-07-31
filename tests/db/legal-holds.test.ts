// Stage CJH (third/fourth supplemental queue): legal-hold mechanism
// (20260101011500_legal_holds.sql). place_legal_hold()/release_legal_hold() are admin-only,
// server-stamp the real actor, and an active hold now blocks execute_account_deletion() (Stage AI)
// the exact same way an unresolved business obligation already does. No UI exists to place a hold
// yet -- explicitly requested by name in this queue regardless (the same precedent as Stage
// BL-addendum's support cases); this proves the backend contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { as, freshClient, ids, uniqueTestEmail } from "./helpers.ts";

test("place_legal_hold/release_legal_hold: admin-only, server-stamped actor", async (t) => {
  const admin = await as("admin");
  const ops = await as("ops");
  let holdId: string | undefined;

  await t.test("a non-admin (even ops staff) cannot place a legal hold", async () => {
    const attempt = await ops.rpc("place_legal_hold", {
      p_subject_profile_id: ids.customer,
      p_reason: "Unauthorised attempt.",
    });
    assert.ok(attempt.error, "expected only an admin to be able to place a hold");
  });

  await t.test("an admin places a real hold", async () => {
    const call = await admin.rpc("place_legal_hold", {
      p_subject_profile_id: ids.customer,
      p_reason: "Stage CJH test hold.",
    });
    assert.equal(call.error, null);
    holdId = call.data as string;
    assert.ok(holdId);

    const row = await admin
      .from("legal_holds")
      .select("subject_profile_id, reason, placed_by, released_at")
      .eq("id", holdId)
      .single();
    assert.equal(row.error, null);
    assert.equal(row.data?.subject_profile_id, ids.customer);
    assert.equal(
      row.data?.placed_by,
      ids.admin,
      "the real caller must be server-stamped, never forgeable",
    );
    assert.equal(row.data?.released_at, null);
  });

  await t.test("a non-admin cannot release it", async () => {
    const attempt = await ops.rpc("release_legal_hold", { p_hold_id: holdId! });
    assert.ok(attempt.error, "expected only an admin to be able to release a hold");
  });

  await t.test(
    "an admin releases it; the row survives, marked released, never deleted",
    async () => {
      const call = await admin.rpc("release_legal_hold", {
        p_hold_id: holdId!,
        p_release_reason: "Test cleanup.",
      });
      assert.equal(call.error, null);

      const row = await admin
        .from("legal_holds")
        .select("released_at, released_by, release_reason")
        .eq("id", holdId!)
        .single();
      assert.equal(row.error, null);
      assert.ok(row.data?.released_at, "the hold row must still exist, marked released");
      assert.equal(row.data?.released_by, ids.admin);
      assert.equal(row.data?.release_reason, "Test cleanup.");
    },
  );

  await t.test("releasing an already-released hold is rejected, not silently no-op", async () => {
    const attempt = await admin.rpc("release_legal_hold", { p_hold_id: holdId! });
    assert.ok(attempt.error, "expected a clear error, not a silent no-op, for a double release");
  });
});

// Stage XR-16 (legal-hold propagation): revalidating CJH found place_legal_hold()/
// release_legal_hold() never wrote an audit_logs entry at all, unlike every other comparably
// consequential admin action -- 20260101013300_legal_hold_audit_trail.sql closes it.
test("place_legal_hold/release_legal_hold: both transitions are recorded in the shared audit trail", async (t) => {
  const admin = await as("admin");
  let holdId: string | undefined;

  await t.test("placing a hold writes a real audit_logs entry", async () => {
    const call = await admin.rpc("place_legal_hold", {
      p_subject_profile_id: ids.customer,
      p_reason: "XR-16 audit trail test.",
    });
    assert.equal(call.error, null);
    holdId = call.data as string;

    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, target_type, target_id, after")
      .eq("action", "legal_hold.placed")
      .eq("target_id", ids.customer)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.admin, "the real caller must be the actor");
    assert.equal(audit.data?.target_type, "profiles");
    assert.equal((audit.data?.after as { hold_id: string })?.hold_id, holdId);
  });

  await t.test("releasing it writes a real, separate audit_logs entry", async () => {
    const call = await admin.rpc("release_legal_hold", {
      p_hold_id: holdId!,
      p_release_reason: "XR-16 test cleanup.",
    });
    assert.equal(call.error, null);

    const audit = await admin
      .from("audit_logs")
      .select("actor_profile_id, target_type, target_id, after")
      .eq("action", "legal_hold.released")
      .eq("target_id", ids.customer)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal(audit.error, null);
    assert.equal(audit.data?.actor_profile_id, ids.admin);
    assert.equal(
      (audit.data?.after as { release_reason: string })?.release_reason,
      "XR-16 test cleanup.",
    );
  });
});

test("execute_account_deletion: refuses while an active legal hold exists", async (t) => {
  const admin = await as("admin");
  const disposableClient = freshClient();
  let disposableId: string | undefined;
  let requestId: string | undefined;
  let holdId: string | undefined;

  await t.test("setup: a fresh throwaway account requests its own deletion", async () => {
    const email = uniqueTestEmail("legal-hold-test");
    const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
    assert.equal(signUp.error, null);
    disposableId = signUp.data.user?.id;
    assert.ok(disposableId);

    const request = await disposableClient
      .from("account_deletion_requests")
      .insert({ profile_id: disposableId, reason: "CJH stage test" })
      .select("id")
      .single();
    assert.equal(request.error, null);
    requestId = request.data!.id as string;
  });

  await t.test("an admin places a legal hold on this disposable account", async () => {
    const call = await admin.rpc("place_legal_hold", {
      p_subject_profile_id: disposableId!,
      p_reason: "Under investigation (test).",
    });
    assert.equal(call.error, null);
    holdId = call.data as string;
  });

  await t.test("execute_account_deletion is refused while the hold is active", async () => {
    const attempt = await admin.rpc("execute_account_deletion", { p_request_id: requestId! });
    assert.ok(attempt.error, "expected the deletion to be blocked by the active legal hold");
    assert.match(attempt.error!.message, /legal hold/);
  });

  await t.test("releasing the hold allows the deletion to proceed", async () => {
    const release = await admin.rpc("release_legal_hold", { p_hold_id: holdId! });
    assert.equal(release.error, null);

    const call = await admin.rpc("execute_account_deletion", { p_request_id: requestId! });
    assert.equal(call.error, null, "the deletion must now succeed once the hold is released");
  });
});

// Stage FA-4 (legal-hold enforcement completeness): execute_account_deletion() was the only place
// an active hold was ever actually checked. A subject under a hold could still freely destroy their
// own comments and applications one at a time through ordinary self-service RLS deletes that never
// knew legal holds existed. 20260101014200_legal_hold_self_delete_lock.sql closes both.
test("an active legal hold blocks self-service deletion of comments and applications", async (t) => {
  const admin = await as("admin");
  const disposableClient = freshClient();
  let disposableId: string | undefined;
  let postId: string | undefined;
  let commentId: string | undefined;
  let applicationId: string | undefined;
  let holdId: string | undefined;

  try {
    await t.test(
      "setup: a fresh throwaway account creates a comment and an application",
      async () => {
        const email = uniqueTestEmail("legal-hold-self-delete");
        const signUp = await disposableClient.auth.signUp({ email, password: "password123" });
        assert.equal(signUp.error, null);
        disposableId = signUp.data.user?.id;
        assert.ok(disposableId);

        const post = await disposableClient
          .from("posts")
          .insert({
            author_profile_id: disposableId,
            content: "FA-4 legal hold self-delete test post.",
            visibility: "public",
          })
          .select("id")
          .single();
        assert.equal(post.error, null);
        postId = post.data!.id as string;

        const comment = await disposableClient
          .from("comments")
          .insert({
            post_id: postId,
            author_profile_id: disposableId,
            content: "A comment that should be preservable under hold.",
          })
          .select("id")
          .single();
        assert.equal(comment.error, null);
        commentId = comment.data!.id as string;

        const application = await disposableClient
          .from("buyer_applications")
          .insert({
            animal_id: ids.animalReksio,
            buyer_id: disposableId,
            organization_id: ids.orgFundacja,
            application_type: "adoption",
            message: "FA-4 legal hold self-delete test application.",
          })
          .select("id")
          .single();
        assert.equal(application.error, null);
        applicationId = application.data!.id as string;
      },
    );

    await t.test(
      "before any hold, the account can delete its own comment/application freely",
      async () => {
        // Prove the trigger is hold-specific, not a blanket new restriction, by deleting and
        // recreating each row before placing the hold.
        const deletedComment = await disposableClient
          .from("comments")
          .delete()
          .eq("id", commentId!);
        assert.equal(deletedComment.error, null);
        const deletedApplication = await disposableClient
          .from("buyer_applications")
          .delete()
          .eq("id", applicationId!);
        assert.equal(deletedApplication.error, null);

        const comment = await disposableClient
          .from("comments")
          .insert({
            post_id: postId!,
            author_profile_id: disposableId,
            content: "Recreated before the hold is placed.",
          })
          .select("id")
          .single();
        assert.equal(comment.error, null);
        commentId = comment.data!.id as string;

        const application = await disposableClient
          .from("buyer_applications")
          .insert({
            animal_id: ids.animalReksio,
            buyer_id: disposableId,
            organization_id: ids.orgFundacja,
            application_type: "adoption",
            message: "Recreated before the hold is placed.",
          })
          .select("id")
          .single();
        assert.equal(application.error, null);
        applicationId = application.data!.id as string;
      },
    );

    await t.test("an admin places a legal hold on this disposable account", async () => {
      const call = await admin.rpc("place_legal_hold", {
        p_subject_profile_id: disposableId!,
        p_reason: "FA-4 self-delete lock test.",
      });
      assert.equal(call.error, null);
      holdId = call.data as string;
    });

    await t.test(
      "the account can no longer delete its own comment while the hold is active",
      async () => {
        const attempt = await disposableClient.from("comments").delete().eq("id", commentId!);
        assert.ok(attempt.error, "expected the legal hold to block this deletion");
      },
    );

    await t.test(
      "the account can no longer delete its own application while the hold is active",
      async () => {
        const attempt = await disposableClient
          .from("buyer_applications")
          .delete()
          .eq("id", applicationId!);
        assert.ok(attempt.error, "expected the legal hold to block this deletion");
      },
    );

    await t.test("even an admin cannot delete the comment while the hold is active", async () => {
      const attempt = await admin.from("comments").delete().eq("id", commentId!);
      assert.ok(
        attempt.error,
        "a legal hold blocks the destructive action itself, not just self-service",
      );
    });

    await t.test("releasing the hold allows deletion again", async () => {
      const release = await admin.rpc("release_legal_hold", { p_hold_id: holdId! });
      assert.equal(release.error, null);

      const deletedComment = await disposableClient.from("comments").delete().eq("id", commentId!);
      assert.equal(deletedComment.error, null);
      commentId = undefined;

      const deletedApplication = await disposableClient
        .from("buyer_applications")
        .delete()
        .eq("id", applicationId!);
      assert.equal(deletedApplication.error, null);
      applicationId = undefined;
    });
  } finally {
    await t.test("cleanup", async () => {
      if (holdId) {
        const stillActive = await admin
          .from("legal_holds")
          .select("released_at")
          .eq("id", holdId)
          .single();
        if (stillActive.data && stillActive.data.released_at === null) {
          await admin.rpc("release_legal_hold", { p_hold_id: holdId });
        }
      }
      if (commentId) await admin.from("comments").delete().eq("id", commentId);
      if (applicationId) await admin.from("buyer_applications").delete().eq("id", applicationId);
      if (postId) await admin.from("posts").delete().eq("id", postId);
    });
  }
});
