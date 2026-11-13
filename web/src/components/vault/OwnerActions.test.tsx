import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { approveTx, rejectTx } from "@/lib/actions";
import { ATTACKER, ROOT, VAULT } from "@/lib/test-fixtures";
import type { InboxItem } from "@/lib/views";
import { setReducedMotion } from "@/test/media";
import { OwnerDashboard, WithOwnerAction } from "@/test/owner";
import { renderUI } from "@/test/render";
import { vaultView } from "@/test/views";
import { FakeWallet } from "../wallet/test-wallet";
import { OwnerActions } from "./OwnerActions";

const HIGH_REASON = "Payee not in the signed mandate; payout change not confirmed with the payee";
const CONFIRM_TEXT = `Pay 49 tUSDC to ${ATTACKER} from task 2.`;
const TICK = "I confirmed this address with the payee outside this conversation.";

function held(level?: "medium" | "low"): InboxItem {
  const inbox = vaultView("vault").inbox;
  if (inbox.kind !== "lineage") throw new Error("expected the Lineage inbox");
  const item = inbox.items[0];
  return level ? { ...item, risk: { ...item.risk, level } } : item;
}

function mount(item = held(), fake = new FakeWallet({ account: ROOT }), refresh = () => {}) {
  renderUI(<WithOwnerAction fake={fake} refresh={refresh}>{(action) => <OwnerActions item={item} owner={{ vault: VAULT, action }} />}</WithOwnerAction>);
  return fake;
}

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => act(() => fireEvent.click(btn(name)));
const clickAsync = (name: string | RegExp) => act(async () => fireEvent.click(btn(name)));

afterEach(() => vi.useRealTimers());

describe("OwnerActions", () => {
  it("idle: Reject is primary, Approve secondary with the attacker tone on high risk; nothing is sent", () => {
    const fake = mount();
    expect(btn("Reject")).toHaveAttribute("data-variant", "primary");
    expect(btn("Approve")).toHaveAttribute("data-tone", "attacker");
    expect(screen.getByText(/Your wallet will ask you to confirm/)).toBeInTheDocument();
    expect(fake.sent).toEqual([]);
  });

  it("high risk: the confirm names the exact amount and full payee, and the checkbox gates Approve and sign", async () => {
    const fake = mount();
    click("Approve");
    const group = screen.getByRole("group", { name: "Confirm approval" });
    expect(group).toHaveTextContent(CONFIRM_TEXT);
    expect(within(group).getByText(ATTACKER)).toBeInTheDocument();
    const box = screen.getByRole("checkbox", { name: TICK });
    expect(box).toHaveFocus();
    expect(btn("Approve and sign")).toBeDisabled();
    act(() => fireEvent.click(box));
    expect(btn("Approve and sign")).toBeEnabled();
    expect(btn("Approve and sign")).toHaveAttribute("data-tone", "attacker");
    await clickAsync("Approve and sign");
    expect(fake.sent).toStrictEqual([approveTx(VAULT, 5)]);
  });

  it("medium risk: no checkbox, confirm enabled, no attacker tone", async () => {
    const fake = mount(held("medium"));
    expect(btn("Approve")).toHaveAttribute("data-tone", "neutral");
    click("Approve");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(btn("Approve and sign")).toBeEnabled();
    expect(btn("Approve and sign")).toHaveFocus();
    await clickAsync("Approve and sign");
    expect(fake.sent).toStrictEqual([approveTx(VAULT, 5)]);
  });

  it("reject: prefilled editable reason with a 140 count, sent trimmed", async () => {
    const fake = mount();
    click("Reject");
    const field = screen.getByRole("textbox", { name: /Reason/ });
    expect(field).toHaveValue(HIGH_REASON);
    expect(field).toHaveFocus();
    expect(screen.getByText("75/140")).toBeInTheDocument();
    act(() => fireEvent.change(field, { target: { value: "  wrong payee  " } }));
    expect(screen.getByText("15/140")).toBeInTheDocument();
    await clickAsync("Reject and sign");
    expect(fake.sent).toStrictEqual([rejectTx(VAULT, 5, "wrong payee")]);
    expect(fake.sent[0].actions[0].params.args).toStrictEqual({ payment_id: 5, reason: "wrong payee" });
  });

  it("reject: the field stops at 140 code points without splitting an emoji", () => {
    mount();
    click("Reject");
    const field = screen.getByRole("textbox", { name: /Reason/ }) as HTMLTextAreaElement;
    act(() => fireEvent.change(field, { target: { value: "a".repeat(139) + "🚨" + "b".repeat(60) } }));
    expect(Array.from(field.value)).toHaveLength(140);
    expect(field.value.endsWith("🚨")).toBe(true);
    expect(screen.getByText("140/140")).toBeInTheDocument();
  });

  it("Back sends nothing, refocuses the opener, and the high-risk tick never carries over", () => {
    const fake = mount();
    click("Approve");
    act(() => fireEvent.click(screen.getByRole("checkbox", { name: TICK })));
    click("Back");
    expect(btn("Approve")).toHaveFocus();

    click("Approve");
    expect(screen.getByRole("checkbox", { name: TICK })).not.toBeChecked();
    expect(btn("Approve and sign")).toBeDisabled();
    act(() => fireEvent.click(screen.getByRole("checkbox", { name: TICK })));
    click("Back");

    click("Reject");
    click("Back");
    expect(btn("Reject")).toHaveFocus();
    click("Approve");
    expect(screen.getByRole("checkbox", { name: TICK })).not.toBeChecked();
    expect(btn("Approve and sign")).toBeDisabled();
    expect(fake.sent).toEqual([]);
  });

  it("while the wallet is open: 'Waiting for your wallet…', every owner control disabled, no 'Sending'", () => {
    const fake = new FakeWallet({ account: ROOT });
    fake.defer();
    renderUI(<OwnerDashboard initial={vaultView("vault")} fake={fake} />);
    click("Reject");
    act(() => {
      fireEvent.click(btn("Reject and sign"));
    });
    expect(btn("Waiting for your wallet…")).toBeDisabled();
    expect(btn("Back")).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Reason/ })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Freeze vault" })).toBeDisabled();
    expect(screen.queryByText(/Sending/)).toBeNull();
    expect(fake.sent).toHaveLength(1);
  });

  it("closing the wallet: 'Cancelled in the wallet', controls enabled again, at most two refreshes", async () => {
    vi.useFakeTimers();
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = () => Promise.reject(new Error("User rejected"));
    const refresh = vi.fn();
    mount(held(), fake, refresh);
    click("Reject");
    await clickAsync("Reject and sign");
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled in the wallet");
    expect(btn("Reject and sign")).toBeEnabled();
    expect(btn("Back")).toBeEnabled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("reduced motion: the confirm swaps in instantly, with no animated wrapper", () => {
    setReducedMotion(true);
    mount();
    click("Approve");
    const group = screen.getByRole("group", { name: "Confirm approval" });
    expect(group).not.toHaveAttribute("style");
    expect(group.parentElement).not.toHaveAttribute("style");
  });
});
