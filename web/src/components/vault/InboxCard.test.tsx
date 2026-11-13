import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ATTACKER, ROOT, VAULT, p3Translation, p4Alice, p5Poisoned } from "@/lib/test-fixtures";
import { LIMITS_ONLY_INBOX } from "@/lib/views";
import { renderUI } from "@/test/render";
import { vaultView } from "@/test/views";
import { WithOwnerAction } from "@/test/owner";
import { FakeWallet } from "../wallet/test-wallet";
import { Inbox } from "./InboxCard";

const CONTROLS = /approve|reject|freeze|withdraw/i;

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

    it("owner: Reject and Approve on the held card, neither sends on first click", () => {
      const fake = new FakeWallet({ account: ROOT });
      renderUI(
        <WithOwnerAction fake={fake}>{(action) => <Inbox inbox={vaultView("vault").inbox} owner={{ vault: VAULT, action }} />}</WithOwnerAction>,
      );
      const card = screen.getByRole("article", { name: /Payment #5/ });
      act(() => fireEvent.click(within(card).getByRole("button", { name: "Reject" })));
      act(() => fireEvent.click(within(card).getByRole("button", { name: "Back" })));
      act(() => fireEvent.click(within(card).getByRole("button", { name: "Approve" })));
      expect(fake.sent).toEqual([]);
    });

    it("an XSS memo stays literal text with the approve confirm open, which names the real payee", () => {
      const xss = "<img src=x onerror=alert(1)> A-102";
      const v = vaultView("vault", [p3Translation(), p4Alice(), { ...p5Poisoned(), memo: xss }]);
      const { container } = renderUI(
        <WithOwnerAction fake={new FakeWallet({ account: ROOT })}>{(action) => <Inbox inbox={v.inbox} owner={{ vault: VAULT, action }} />}</WithOwnerAction>,
      );
      act(() => fireEvent.click(screen.getByRole("button", { name: "Approve" })));
      expect(container.querySelector("img")).toBeNull();
      expect(container).toHaveTextContent(xss);
      expect(screen.getByRole("group", { name: "Confirm approval" })).toHaveTextContent(`Pay 49 tUSDC to ${ATTACKER} from task 2.`);
    });
  });
});
