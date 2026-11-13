import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { explorerTx } from "@/lib/config";
import { createTaskTx, demoMandateForm, validateMandate } from "@/lib/mandate";
import type { Role } from "@/lib/wallet";
import { ALICE, DEMO_RUN_SNAPSHOT, NOW, ROOT, VAULT, demoTask, p3Translation, p4Alice, p5Poisoned, payment } from "@/lib/test-fixtures";
import { OwnerDashboard, WithOwnerAction, live } from "@/test/owner";
import { renderUI } from "@/test/render";
import { demoPayments, demoTask0, vaultView } from "@/test/views";
import { FAKE_HASH, FakeWallet, okOutcome } from "../wallet/test-wallet";
import { VaultDashboard } from "./VaultDashboard";

const XSS = "<img src=x onerror=alert(1)>";
const COMMAND = "npm run demo -- --task 15";
const tasks = () => [demoTask0(), demoTask(undefined, { id: 1 }), demoTask()];
const lineageView = (payments = demoPayments("vault")) => vaultView("vault", payments, tasks());

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (name: string | RegExp) => act(() => fireEvent.click(btn(name)));
const form = () => screen.queryByRole("form", { name: "New task" });
const field = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;

function owner(fake = new FakeWallet({ account: ROOT }), initial = lineageView()) {
  renderUI(<OwnerDashboard initial={initial} fake={fake} />);
  return fake;
}

function asRole(key: "vault" | "guarded", role: Role, accountId: string | null) {
  const fake = new FakeWallet({ account: accountId });
  return renderUI(
    <WithOwnerAction fake={fake}>
      {(action) => (
        <VaultDashboard view={key === "vault" ? lineageView() : vaultView("guarded")} demoRun={DEMO_RUN_SNAPSHOT} now={NOW} wallet={{ role, accountId, action }} />
      )}
    </WithOwnerAction>,
  );
}

async function signDemo() {
  click("New task");
  click("Use demo mandate");
  click("Review");
  await act(async () => fireEvent.click(btn("Sign in wallet")));
}

function mockClipboard(writeText: (s: string) => Promise<void>) {
  const spy = vi.fn(writeText);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: spy }, configurable: true });
  return spy;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  vi.useRealTimers();
});

describe("Tasks section: new task", () => {
  it("the owner on the Lineage vault gets a New task button in the section header; the form opens inline above the cards", () => {
    owner();
    const section = screen.getByRole("region", { name: "Tasks" });
    expect(form()).toBeNull();
    const open = within(section).getByRole("button", { name: "New task" });
    act(() => fireEvent.click(open));
    expect(within(section).queryByRole("button", { name: "New task" })).toBeNull();
    const f = within(section).getByRole("form", { name: "New task" });
    const firstCard = within(section).getByRole("article", { name: "Task #2" });
    expect(f.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("viewer, disconnected and no wallet never see it", () => {
    for (const [role, id] of [["viewer", ALICE], ["disconnected", null]] as const) {
      const { unmount } = asRole("vault", role, id);
      expect(screen.queryByRole("button", { name: "New task" })).toBeNull();
      expect(form()).toBeNull();
      unmount();
    }
    renderUI(<VaultDashboard view={lineageView()} demoRun={DEMO_RUN_SNAPSHOT} now={NOW} />);
    expect(screen.queryByRole("button", { name: "New task" })).toBeNull();
  });

  it("the owner on the Guarded vault never sees it", () => {
    asRole("guarded", "owner", ROOT);
    expect(screen.getByRole("switch", { name: "Freeze vault" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New task" })).toBeNull();
  });

  it("Cancel closes the form and returns focus to New task", () => {
    owner();
    click("New task");
    click("Cancel");
    expect(form()).toBeNull();
    expect(btn("New task")).toHaveFocus();
  });

  it("signs the demo mandate through the shared action; success shows Task #15, the hash, and the command", async () => {
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = async () => okOutcome(FAKE_HASH, "MTU=");
    owner(fake);
    await signDemo();
    const r = validateMandate(demoMandateForm(demoTask0()));
    if (!r.ok) throw new Error("demo mandate must validate");
    expect(fake.sent).toStrictEqual([createTaskTx(VAULT, r.args)]);
    expect(form()).toBeNull();
    const line = screen.getByTestId("created-task");
    expect(line).toHaveTextContent("Task #15 created");
    expect(within(line).getByRole("link")).toHaveAttribute("href", explorerTx(FAKE_HASH));
    expect(within(line).getByText("Sent")).toBeInTheDocument();
    expect(line).toHaveTextContent("Run the agent on it:");
    expect(within(line).getByText(COMMAND)).toHaveClass("font-mono");
    expect(btn("New task")).toHaveFocus();
  });

  it("Copy writes the command to the clipboard", async () => {
    const write = mockClipboard(async () => {});
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = async () => okOutcome(FAKE_HASH, "MTU=");
    owner(fake);
    await signDemo();
    await act(async () => fireEvent.click(btn("Copy")));
    expect(write).toHaveBeenCalledWith(COMMAND);
    expect(btn("Copied")).toBeInTheDocument();
  });

  it("when the clipboard is blocked it says Select and copy, and one click selects the whole command", async () => {
    mockClipboard(() => Promise.reject(new Error("denied")));
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = async () => okOutcome(FAKE_HASH, "MTU=");
    owner(fake);
    await signDemo();
    await act(async () => fireEvent.click(btn("Copy")));
    expect(screen.getByText("Select and copy")).toBeInTheDocument();
    expect(screen.getByText(COMMAND)).toHaveClass("select-all");
  });

  it("no task id in the result: Task created plus the hash, no command", async () => {
    owner();
    await signDemo();
    const line = screen.getByTestId("created-task");
    expect(line).toHaveTextContent("Task created");
    expect(line).not.toHaveTextContent("#");
    expect(within(line).getByRole("link")).toHaveAttribute("href", explorerTx(FAKE_HASH));
    expect(screen.queryByText(/npm run demo/)).toBeNull();
  });

  it("a failure keeps the form open with its values; no result line", async () => {
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = () => Promise.reject(new Error("User rejected"));
    owner(fake);
    await signDemo();
    expect(form()).toBeInTheDocument();
    expect(screen.queryByTestId("created-task")).toBeNull();
    click("Edit");
    expect(field("Budget")).toHaveValue("100");
  });

  it("a poll refresh with a new view keeps the open form, its typed values and the confirm", () => {
    owner();
    click("New task");
    click("Use demo mandate");
    act(() => fireEvent.change(field("Budget"), { target: { value: "90" } }));
    act(() => live.setView(lineageView([...demoPayments("vault"), payment({ id: 6, status: "Paid" })])));
    expect(field("Budget")).toHaveValue("90");
    click("Review");
    const confirm = screen.getByRole("group", { name: "Confirm new task" });
    expect(confirm).toHaveTextContent("90 tUSDC");
    act(() => live.setView(lineageView([...demoPayments("vault"), payment({ id: 6 }), payment({ id: 7 })])));
    expect(screen.getByRole("group", { name: "Confirm new task" })).toHaveTextContent("90 tUSDC");
    click("Edit");
    expect(field("Budget")).toHaveValue("90");
  });

  it("one action at a time: while the task is signing the inbox and the freeze switch are disabled", async () => {
    const fake = new FakeWallet({ account: ROOT });
    const d = fake.defer();
    owner(fake);
    click("New task");
    click("Use demo mandate");
    click("Review");
    act(() => {
      fireEvent.click(btn("Sign in wallet"));
    });
    const card = screen.getByRole("article", { name: /Payment #5/ });
    expect(within(card).getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Freeze vault" })).toBeDisabled();
    await act(async () => d.resolve(okOutcome(FAKE_HASH, "MTU=")));
    expect(screen.getByRole("switch", { name: "Freeze vault" })).toBeEnabled();
  });

  it("LastAction and the freeze switch ignore create-task", async () => {
    const fake = new FakeWallet({ account: ROOT });
    fake.sendImpl = async () => okOutcome(FAKE_HASH, "MTU=");
    owner(fake);
    await signDemo();
    act(() => live.setView(lineageView([p3Translation(), p4Alice(), p5Poisoned()])));
    expect(screen.getByTestId("created-task")).toBeInTheDocument();
    expect(screen.queryByTestId("last-action")).toBeNull();
    expect(within(screen.getByRole("banner", { name: "Lineage vault" })).queryByRole("status")).toBeNull();
  });

  it("the newest task is the visible card; the demo-run chip moves into Earlier tasks with its task", () => {
    owner(new FakeWallet({ account: ROOT }), vaultView("vault", demoPayments("vault"), [...tasks(), demoTask(undefined, { id: 3, spent: "0" })]));
    const section = screen.getByRole("region", { name: "Tasks" });
    const earlier = within(section).getByText("Earlier tasks (3)").closest("details")!;
    const newest = within(section).getByRole("article", { name: "Task #3" });
    expect(earlier.contains(newest)).toBe(false);
    expect(within(earlier).getByRole("article", { name: "Task #2" })).toHaveTextContent("latest demo run");
  });

  it("TaskCard renders an HTML-looking instruction as text", () => {
    const { container } = renderUI(
      <VaultDashboard view={vaultView("vault", demoPayments("vault"), [demoTask(undefined, { instruction: XSS })])} demoRun={DEMO_RUN_SNAPSHOT} now={NOW} />,
    );
    expect(within(screen.getByRole("article", { name: "Task #2" })).getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
