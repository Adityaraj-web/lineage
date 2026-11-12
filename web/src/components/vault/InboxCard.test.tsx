import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { rejectTx } from "@/lib/actions";
import { ROOT, VAULT, p3Translation, p4Alice, p5Poisoned } from "@/lib/test-fixtures";
import { LIMITS_ONLY_INBOX } from "@/lib/views";
import { renderUI } from "@/test/render";
import { vaultView } from "@/test/views";
import { WithOwnerAction } from "@/test/owner";
import { FakeWallet } from "../wallet/test-wallet";
import { Inbox } from "./InboxCard";

const CONTROLS = /approve|reject|freeze|withdraw/i;
const HIGH_REASON = "Payee not in the signed mandate; payout change not confirmed with the payee";

describe("Inbox", () => {
  it("shows the held P3 with its risk card and the earlier A-102 payment to Alice", () => {
    const v = vaultView("vault");
    const { container } = renderUI(<Inbox inbox={v.inbox} />);
    const card = screen.getByRole("article", { name: /Payment #5/ });
    expect(within(card).getByText("High risk")).toBeInTheDocument();
    expect(within(card).getAllByText("49 tUSDC").length).toBeGreaterThan(0);
    const related = within(card).getByTestId("related-payment-4");
    expect(within(related).getByText("18 tUSDC")).toBeInTheDocument();
    expect(related).toHaveTextContent("alice.lineage-aditya.testnet");
    const marks = [...container.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks).toEqual(["A-102", "A-102"]);
  });

  it("an XSS memo on a held payment stays literal text", () => {
    const xss = "<img src=x onerror=alert(1)> A-102";
    const v = vaultView("vault", [p3Translation(), p4Alice(), { ...p5Poisoned(), memo: xss }]);
    const { container } = renderUI(<Inbox inbox={v.inbox} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent(xss);
  });

  it("LimitsOnly explains that it never asks", () => {
    renderUI(<Inbox inbox={vaultView("guarded").inbox} />);
    expect(screen.getByText(LIMITS_ONLY_INBOX)).toBeInTheDocument();
  });

  it("an empty Lineage inbox says nothing is waiting", () => {
    renderUI(<Inbox inbox={vaultView("vault", [p3Translation(), p4Alice(), p5Poisoned("Rejected")]).inbox} />);
    expect(screen.getByText(/Nothing is waiting for you/)).toBeInTheDocument();
  });

  describe("controls only for the owner", () => {
    it("without owner controls: no approve or reject buttons", () => {
      renderUI(<Inbox inbox={vaultView("vault").inbox} />);
      expect(screen.queryByRole("button", { name: CONTROLS })).toBeNull();
    });

    it("owner: Reject on the held card sends rejectTx with the high-risk reason", async () => {
      const fake = new FakeWallet({ account: ROOT });
      renderUI(
        <WithOwnerAction fake={fake}>{(action) => <Inbox inbox={vaultView("vault").inbox} owner={{ vault: VAULT, action }} />}</WithOwnerAction>,
      );
      const card = screen.getByRole("article", { name: /Payment #5/ });
      await act(async () => fireEvent.click(within(card).getByRole("button", { name: "Reject" })));
      expect(fake.sent).toStrictEqual([rejectTx(VAULT, 5, HIGH_REASON)]);
      expect(within(card).getByRole("status")).toHaveTextContent("Sent");
    });

    it("owner: no Approve button yet (it needs the Phase 3 confirm)", () => {
      renderUI(
        <WithOwnerAction fake={new FakeWallet({ account: ROOT })}>
          {(action) => <Inbox inbox={vaultView("vault").inbox} owner={{ vault: VAULT, action }} />}
        </WithOwnerAction>,
      );
      expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    });
  });
});
