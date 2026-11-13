import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTaskTx, emptyMandateForm, type MandateForm as MandateFormData } from "@/lib/mandate";
import { AGENT_G, AGENT_L, ALICE, REGISTRY, ROOT, VAULT } from "@/lib/test-fixtures";
import type { Task } from "@/shared/vault-types";
import { WithOwnerAction } from "@/test/owner";
import { renderUI } from "@/test/render";
import { demoTask0 } from "@/test/views";
import { FAKE_HASH, FakeWallet } from "../wallet/test-wallet";
import { MandateForm } from "./MandateForm";

const TASK0 = demoTask0();
const DEMO_INSTRUCTION = TASK0.instruction;
const XSS = "<img src=x onerror=alert(1)>";
const OWNER_ONLY = "Smart contract panicked: Owner only";

function mount({
  task0 = TASK0 as Task | null,
  fake = new FakeWallet({ account: ROOT }),
  initial = emptyMandateForm(AGENT_L, REGISTRY) as MandateFormData,
  onClose = vi.fn(),
} = {}) {
  const r = renderUI(
    <WithOwnerAction fake={fake}>
      {(action) => <MandateForm owner={{ vault: VAULT, action }} initial={initial} demoAgent={AGENT_L} task0={task0} onClose={onClose} />}
    </WithOwnerAction>,
  );
  return { ...r, fake, onClose };
}

const field = (name: string | RegExp) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => act(() => fireEvent.click(btn(name)));
const type = (name: string | RegExp, value: string) => act(() => fireEvent.change(field(name), { target: { value } }));
const blur = (name: string | RegExp) => act(() => fireEvent.blur(field(name)));
const confirmGroup = () => screen.queryByRole("group", { name: "Confirm new task" });

// A valid hand-typed mandate: budget " 12.50 ", max 5, 7 days, Alice at 2, the default registry resolver.
function fillValid(instruction = "Pay Alice for the logo.") {
  type("Instruction", instruction);
  type("Budget", " 12.50 ");
  type("Max per payment", "5");
  act(() => fireEvent.click(screen.getByRole("radio", { name: "7 days" })));
  click("Add payee");
  type("Payee 1 account", ALICE);
  type("Payee 1 max", "2");
  type("Payee 1 label", "Alice — logo");
}

const EXPECTED_ARGS = {
  agent: AGENT_L,
  instruction: "Pay Alice for the logo.",
  budget: "12500000",
  max_per_payment: "5000000",
  ttl_minutes: 10080,
  signed_payees: [{ account_id: ALICE, max_amount: "2000000", label: "Alice — logo" }],
  resolvers: [REGISTRY],
};

describe("MandateForm", () => {
  it("starts empty on agent-l with the registry pinned and 1 day selected", () => {
    mount();
    expect(screen.getByRole("form", { name: "New task" })).toBeInTheDocument();
    expect(field("Agent")).toHaveValue(AGENT_L);
    expect(field("Instruction")).toHaveValue("");
    expect(field("Budget")).toHaveValue("");
    expect(field("Max per payment")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "1 day" })).toHaveAttribute("aria-checked", "true");
    expect(field("Resolver 1")).toHaveValue(REGISTRY);
    expect(screen.queryByRole("textbox", { name: "Payee 1 account" })).toBeNull();
    expect(screen.getByText("The vault pays exactly what these return. Add only resolvers you trust.")).toBeInTheDocument();
  });

  it("amount fields ask for a decimal keyboard and use tabular figures", () => {
    mount();
    for (const name of ["Budget", "Max per payment"]) {
      expect(field(name)).toHaveAttribute("inputmode", "decimal");
      expect(field(name)).toHaveClass("num");
    }
  });

  it("Use demo mandate fills every field from task 0", () => {
    mount();
    type("Agent", "someone.testnet");
    type("Budget", "3");
    act(() => fireEvent.click(screen.getByRole("radio", { name: "1 hour" })));
    click("Use demo mandate");
    expect(field("Agent")).toHaveValue(AGENT_L);
    expect(field("Instruction")).toHaveValue(DEMO_INSTRUCTION);
    expect(field("Budget")).toHaveValue("100");
    expect(field("Max per payment")).toHaveValue("50");
    expect(screen.getByRole("radio", { name: "14 days" })).toHaveAttribute("aria-checked", "true");
    expect(field("Payee 1 account")).toHaveValue(ALICE);
    expect(field("Payee 1 max")).toHaveValue("20");
    expect(field("Payee 1 label")).toHaveValue("Alice — logo");
    expect(field("Resolver 1")).toHaveValue(REGISTRY);
    expect(screen.queryByRole("textbox", { name: "Payee 2 account" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Resolver 2" })).toBeNull();
  });

  it("no task 0 in the view: no Use demo mandate button", () => {
    mount({ task0: null });
    expect(screen.queryByRole("button", { name: "Use demo mandate" })).toBeNull();
  });

  it("an error shows after the field is touched, with aria-invalid and aria-describedby wired", () => {
    mount();
    type("Budget", "1e3");
    expect(screen.queryByText("Use a number with up to 6 decimals")).toBeNull();
    expect(field("Budget")).toHaveAttribute("aria-invalid", "false");
    blur("Budget");
    const err = screen.getByText("Use a number with up to 6 decimals");
    expect(field("Budget")).toHaveAttribute("aria-invalid", "true");
    expect(field("Budget").getAttribute("aria-describedby")?.split(" ")).toContain(err.id);
    expect(field("Budget")).toHaveAccessibleDescription(/Use a number with up to 6 decimals/);
  });

  it("invalid input blocks Review, shows the field error and focuses the first invalid field", () => {
    const { fake } = mount();
    fillValid();
    type("Budget", "1e3");
    click("Review");
    expect(confirmGroup()).toBeNull();
    expect(field("Budget")).toHaveAttribute("aria-invalid", "true");
    expect(field("Budget")).toHaveFocus();
    expect(screen.getByText("Use a number with up to 6 decimals")).toBeInTheDocument();
    expect(fake.sent).toEqual([]);
  });

  it("Review on an empty form shows every error at once", () => {
    mount();
    click("Review");
    expect(confirmGroup()).toBeNull();
    expect(field("Instruction")).toHaveAttribute("aria-invalid", "true");
    expect(field("Instruction")).toHaveFocus();
    expect(field("Budget")).toHaveAttribute("aria-invalid", "true");
    expect(field("Max per payment")).toHaveAttribute("aria-invalid", "true");
    expect(field("Agent")).toHaveAttribute("aria-invalid", "false");
  });

  it("payee row errors are per field", () => {
    mount();
    fillValid();
    type("Payee 1 account", "Alice.testnet");
    type("Payee 1 max", "13");
    click("Review");
    expect(field("Payee 1 account")).toHaveAccessibleDescription(/Use lowercase/);
    expect(field("Payee 1 max")).toHaveAccessibleDescription(/Can't exceed the budget/);
    expect(field("Payee 1 label")).toHaveAttribute("aria-invalid", "false");
  });

  it("the confirm is built from the validated args, not the inputs: ' 12.50 ' shows as 12.5", () => {
    mount();
    fillValid();
    click("Review");
    const group = confirmGroup()!;
    expect(group).toBeInTheDocument();
    expect(group).toHaveTextContent("12.5 tUSDC");
    expect(group).not.toHaveTextContent("12.50");
    expect(group).toHaveTextContent("5 tUSDC");
    expect(group).toHaveTextContent("7 days");
    expect(within(group).getByText(AGENT_L)).toBeInTheDocument();
    expect(within(group).getByText(ALICE)).toBeInTheDocument();
    expect(within(group).getByText(REGISTRY)).toBeInTheDocument();
    expect(within(group).getByText("Alice — logo")).toBeInTheDocument();
    expect(group).toHaveTextContent("max 2 tUSDC");
    expect(within(group).getByText("Pay Alice for the logo.")).toBeInTheDocument();
    expect(btn("Sign in wallet")).toHaveFocus();
    expect(screen.queryByRole("textbox", { name: "Budget" })).toBeNull();
  });

  it("Sign in wallet sends exactly createTaskTx(vault, args) with 1 yocto", async () => {
    const { fake } = mount();
    fillValid();
    click("Review");
    await act(async () => fireEvent.click(btn("Sign in wallet")));
    expect(fake.sent).toStrictEqual([createTaskTx(VAULT, EXPECTED_ARGS)]);
    expect(fake.sent[0].actions[0].params.methodName).toBe("create_task");
    expect(fake.sent[0].actions[0].params.deposit).toBe("1");
    expect(fake.sent[0].actions[0].params.args).toStrictEqual(EXPECTED_ARGS);
  });

  it("success closes the form", async () => {
    const { onClose } = mount();
    fillValid();
    click("Review");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(btn("Sign in wallet")));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a contract failure shows the chain's reason and keeps the form and its values", async () => {
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = async () => ({
      status: { Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: OWNER_ONLY } } } } },
      transaction: { hash: FAKE_HASH },
    });
    const { onClose } = mount({ fake });
    fillValid();
    click("Review");
    await act(async () => fireEvent.click(btn("Sign in wallet")));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(`Failed: ${OWNER_ONLY}`);
    expect(confirmGroup()).toBeInTheDocument();
    click("Edit");
    expect(field("Budget")).toHaveValue(" 12.50 ");
    expect(field("Instruction")).toHaveValue("Pay Alice for the logo.");
    expect(field("Payee 1 account")).toHaveValue(ALICE);
    expect(screen.getByRole("radio", { name: "7 days" })).toHaveAttribute("aria-checked", "true");
    expect(btn("Review")).toHaveFocus();
  });

  it("a wallet cancel keeps the form open", async () => {
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = () => Promise.reject(new Error("User rejected"));
    const { onClose } = mount({ fake });
    fillValid();
    click("Review");
    await act(async () => fireEvent.click(btn("Sign in wallet")));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled in the wallet");
    expect(btn("Sign in wallet")).toBeEnabled();
  });

  it("an HTML-looking instruction renders as text in the confirm", () => {
    const { container } = mount();
    fillValid(XSS);
    click("Review");
    expect(within(confirmGroup()!).getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("clicking the selected expiry again keeps it (Radix emits an empty value)", () => {
    mount();
    const day = screen.getByRole("radio", { name: "1 day" });
    act(() => fireEvent.click(day));
    expect(day).toHaveAttribute("aria-checked", "true");
    fillValid();
    const week = screen.getByRole("radio", { name: "7 days" });
    act(() => fireEvent.click(week));
    expect(week).toHaveAttribute("aria-checked", "true");
    click("Review");
    expect(confirmGroup()).toHaveTextContent("7 days");
  });

  it("instruction counter counts UTF-8 bytes of the trimmed text", () => {
    mount();
    type("Instruction", " é ");
    expect(screen.getByText("998 bytes left")).toBeInTheDocument();
    type("Instruction", "a".repeat(999) + "é");
    expect(screen.getByText("1 byte over")).toBeInTheDocument();
  });

  it("hints when the agent is not agent-l", () => {
    mount();
    expect(screen.queryByText(/runs only agent-l/)).toBeNull();
    type("Agent", AGENT_G);
    expect(field("Agent")).toHaveAccessibleDescription(/npm run demo -- --task runs only agent-l/);
  });

  it("payees: add up to 20, then Add payee is hidden; remove brings it back", () => {
    mount();
    for (let i = 0; i < 20; i++) click("Add payee");
    expect(screen.getAllByRole("button", { name: /^Remove payee/ })).toHaveLength(20);
    expect(screen.queryByRole("button", { name: "Add payee" })).toBeNull();
    click("Remove payee 1");
    expect(screen.getAllByRole("button", { name: /^Remove payee/ })).toHaveLength(19);
    expect(btn("Add payee")).toBeInTheDocument();
  });

  it("remove takes out the right row", () => {
    mount();
    click("Add payee");
    click("Add payee");
    type("Payee 1 account", "a.testnet");
    type("Payee 2 account", "b.testnet");
    click("Remove payee 1");
    expect(field("Payee 1 account")).toHaveValue("b.testnet");
  });

  it("resolvers: up to 5, then Add resolver is hidden", () => {
    mount();
    for (let i = 0; i < 4; i++) click("Add resolver");
    expect(screen.getAllByRole("button", { name: /^Remove resolver/ })).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Add resolver" })).toBeNull();
    click("Remove resolver 5");
    expect(btn("Add resolver")).toBeInTheDocument();
  });

  it("Cancel calls onClose and sends nothing", () => {
    const { fake, onClose } = mount();
    click("Cancel");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fake.sent).toEqual([]);
  });

  it("while the wallet is open every form button is disabled", () => {
    const fake = new FakeWallet({ account: ROOT });
    fake.defer();
    mount({ fake });
    fillValid();
    click("Review");
    act(() => {
      fireEvent.click(btn("Sign in wallet"));
    });
    expect(btn("Waiting for your wallet…")).toBeDisabled();
    expect(btn("Edit")).toBeDisabled();
    expect(btn("Cancel")).toBeDisabled();
    expect(fake.sent).toHaveLength(1);
  });
});
