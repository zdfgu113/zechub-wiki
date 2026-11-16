
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import WalletList from "@/components/Wallet/WalletList";
import userEvent from "@testing-library/user-event";
import { parseMarkdown } from "@/lib/parseMarkdown";

jest.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (globalThis as { __WALLET_LIST_T?: Record<string, unknown> })
      .__WALLET_LIST_T ?? {},
  }),
}));

jest.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

const wallets = parseMarkdown(`
## [Alive](https://alive.example)
- Devices: Mobile
- Pools: Orchard | Ironwood
- NU7: Compatible
- Stage: Beta

---
## [Gone](https://gone.example)
- Devices: Desktop
- Pools: Orchard
- Status: Deprecated | End-of-life, no NU6.3 support
`);

beforeEach(() => {
  delete (globalThis as { __WALLET_LIST_T?: unknown }).__WALLET_LIST_T;

  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({}),
  })) as any;
});

describe("WalletList", () => {
  it("lists deprecated wallets separately", () => {
    render(<WalletList allWallets={wallets} />);

    expect(screen.getAllByText("1 wallet").length).toBeGreaterThan(0);

    const section = screen
      .getByText(/Deprecated \/ no longer supports Zcash \(1\)/)
      .closest("details") as HTMLElement;

    expect(section).toHaveAttribute("open");
    expect(within(section).getByText("Gone")).toBeInTheDocument();
    expect(
      within(section).getByText("End-of-life, no NU6.3 support")
    ).toBeInTheDocument();

    expect(
      within(section).queryByText("Alive")
    ).not.toBeInTheDocument();

    expect(
      within(section).queryByText(/^NU7:/)
    ).not.toBeInTheDocument();
  });

  it("applies filters to deprecated wallets too", async () => {
    const user = userEvent.setup();

    render(<WalletList allWallets={wallets} />);

    const sidebar = document.querySelector(".wl-sidebar") as HTMLElement;

    const orchard = await within(sidebar).findByRole("checkbox", {
      name: "Orchard",
    });

    await user.click(orchard);

    expect(
      screen.getByText(/Deprecated \/ no longer supports Zcash \(1\)/)
    ).toBeInTheDocument();

    await user.click(
      within(sidebar).getByRole("checkbox", { name: "Mobile" })
    );

    expect(
      screen.queryByText(/Deprecated \/ no longer supports Zcash/)
    ).not.toBeInTheDocument();

    expect(screen.queryByText("Gone")).not.toBeInTheDocument();

    await user.click(
      within(sidebar).getByRole("checkbox", { name: "Mobile" })
    );
    await user.click(orchard);

    expect(
      screen.getByText(/Deprecated \/ no longer supports Zcash \(1\)/)
    ).toBeInTheDocument();
  });

  it("builds filters from active wallets only", async () => {
    render(<WalletList allWallets={wallets} />);

    await waitFor(() =>
      expect(screen.getAllByText("Mobile").length).toBeGreaterThan(1)
    );

    const sidebar = document.querySelector(".wl-sidebar") as HTMLElement;

    expect(
      within(sidebar).getByText("Mobile")
    ).toBeInTheDocument();

    expect(
      within(sidebar).queryByText("Desktop")
    ).not.toBeInTheDocument();
  });

  it("shows NU7 compatibility and the release stage", () => {
    render(<WalletList allWallets={wallets} />);

    expect(
      screen.getByText("NU7: Compatible")
    ).toBeInTheDocument();

    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("orders wallets by NU7 compatibility", () => {
    const list = parseMarkdown(`
## [NoStatus](https://a.example)
- Devices: Mobile

---
## [Late](https://b.example)
- Devices: Mobile
- NU7: Not Ready

---
## [Transp](https://c.example)
- Devices: Mobile
- NU7: Compatible for Transparent ZEC

---
## [Early](https://d.example)
- Devices: Mobile
- NU7: Compatible

---
## [Busy](https://e.example)
- Devices: Mobile
- NU7: In Progress

---
## [Unverified](https://f.example)
- Devices: Mobile
- NU7: Not Verified
`);

    render(<WalletList allWallets={list} />);

    const titles = screen
      .getAllByRole("heading", { level: 5 })
      .map((h) => h.textContent);

    expect(titles).toEqual([
      "Early",
      "Transp",
      "Busy",
      "Late",
      "Unverified",
      "NoStatus",
    ]);
  });

  const sectionMarkdown = `
## [ProdLate](https://prod-late.example)
- Devices: Mobile
- Pools: Orchard
- NU7: Not Ready

---
## [ProdEarly](https://prod-early.example)
- Devices: Mobile
- Pools: Sapling | Transparent
- NU7: Compatible

---
## [IronwoodOnly](https://ironwood.example)
- Devices: Desktop
- Pools: Ironwood
- NU7: Not Ready

---
## [NoPools](https://nopools.example)
- Devices: Mobile
- NU7: In Progress

---
## [BetaShielded](https://beta.example)
- Devices: Desktop
- Pools: Sapling
- NU7: Compatible
- Stage: BETA

---
## [StatusBeta](https://status-beta.example)
- Devices: Desktop
- Pools: Ironwood
- NU7: Not Verified
- Status: Beta | Unaudited

---
## [Clear](https://clear.example)
- Devices: Web
- Pools: Transparent
- NU7: Not Ready

---
## [BetaClear](https://beta-clear.example)
- Devices: Web
- Pools:  Transparent | transparent 
- NU7: Compatible
- Status: Beta

---
## [GoneClear](https://gone-clear.example)
- Devices: Desktop
- Pools: Transparent
- Status: Deprecated | old transparent wallet

---
## [GoneBeta](https://gone-beta.example)
- Devices: Mobile
- Pools: Orchard
- Stage: Beta
- Status: Deprecated | was beta
`;

  const headingText = () => {
    const results = document.querySelector(".wl-results") as HTMLElement;

    return within(results)
      .getAllByRole("heading")
      .map((heading) =>
        (heading.textContent ?? "").replace(/\s+/g, " ").trim()
      );
  };

  it("groups active wallets as production, then beta, then transparent-only", () => {
    render(
      <WalletList allWallets={parseMarkdown(sectionMarkdown)} />
    );

    expect(screen.getAllByText("8 wallets").length).toBeGreaterThan(0);

    expect(headingText()).toEqual([
      "In-production wallets (4)",
      "ProdEarly",
      "NoPools",
      "ProdLate",
      "IronwoodOnly",
      "Beta wallets (2)",
      "BetaShielded",
      "StatusBeta",
      "Transparent-only wallets (2)",
      "BetaClear",
      "Clear",
      "GoneBeta",
      "GoneClear",
    ]);

    const deprecated = screen
      .getByText(/Deprecated \/ no longer supports Zcash \(2\)/)
      .closest("details") as HTMLElement;

    expect(deprecated).toHaveAttribute("open");
    expect(within(deprecated).getByText("GoneBeta")).toBeInTheDocument();
    expect(within(deprecated).getByText("GoneClear")).toBeInTheDocument();
    expect(within(deprecated).getByText("was beta")).toBeInTheDocument();
    expect(
      within(deprecated).queryByText("ProdEarly")
    ).not.toBeInTheDocument();

    document.querySelectorAll(".wl-wallet-group").forEach((group) => {
      expect(within(group as HTMLElement).queryByText("GoneBeta")).not.toBeInTheDocument();
      expect(within(group as HTMLElement).queryByText("GoneClear")).not.toBeInTheDocument();
    });

    expect(screen.getAllByRole("heading", { name: "BetaClear" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "BetaShielded" })).toHaveLength(1);
  });

  it("keeps rating order inside a group and does not let likes cross groups", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        High: 5,
        Low: 1,
        BetaHigh: 4,
        BetaLow: 9,
      }),
    })) as any;

    const list = parseMarkdown(`
## [Low](https://low.example)
- Devices: Mobile
- Pools: Orchard
- NU7: Compatible

---
## [High](https://high.example)
- Devices: Mobile
- Pools: Orchard
- NU7: Compatible

---
## [BetaLow](https://beta-low.example)
- Devices: Mobile
- Pools: Sapling
- NU7: Compatible
- Stage: Beta

---
## [BetaHigh](https://beta-high.example)
- Devices: Mobile
- Pools: Sapling
- NU7: Compatible
- Stage: Beta
`);

    render(<WalletList allWallets={list} />);

    await waitFor(() =>
      expect(headingText()).toEqual([
        "In-production wallets (2)",
        "High",
        "Low",
        "Beta wallets (2)",
        "BetaLow",
        "BetaHigh",
      ])
    );
  });

  it("hides empty groups and keeps the active count across the groups that remain", async () => {
    const user = userEvent.setup();

    render(
      <WalletList allWallets={parseMarkdown(sectionMarkdown)} />
    );

    const sidebar = document.querySelector(".wl-sidebar") as HTMLElement;
    const orchard = await within(sidebar).findByRole("checkbox", {
      name: "Orchard",
    });

    await user.click(orchard);

    expect(screen.getAllByText("1 wallet").length).toBeGreaterThan(0);
    expect(headingText()).toEqual([
      "In-production wallets (1)",
      "ProdLate",
      "GoneBeta",
    ]);
    expect(
      screen.queryByRole("heading", { name: /Beta wallets/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Transparent-only wallets/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Deprecated \/ no longer supports Zcash \(1\)/)
    ).toBeInTheDocument();
    expect(screen.queryByText("GoneClear")).not.toBeInTheDocument();
    expect(screen.queryByText("ProdEarly")).not.toBeInTheDocument();
  });

  it("omits production and beta headings when every active wallet is transparent-only", () => {
    const list = parseMarkdown(`
## [OnlyClear](https://only.example)
- Devices: Web
- Pools: TRANSPARENT
- NU7: Not Ready

---
## [Retired](https://retired.example)
- Devices: Web
- Pools: Transparent
- Status: Deprecated
`);

    render(<WalletList allWallets={list} />);

    expect(headingText()).toEqual([
      "Transparent-only wallets (1)",
      "OnlyClear",
      "Retired",
    ]);
    expect(screen.getAllByText("1 wallet").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: /In-production wallets/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Beta wallets/ })
    ).not.toBeInTheDocument();
  });

  it("uses translated section titles when the dictionary provides them", () => {
    (globalThis as { __WALLET_LIST_T?: Record<string, unknown> }).__WALLET_LIST_T =
      {
        wallets: {
          inProductionTitle: "Wallets en production",
          betaTitle: "Wallets bêta",
          transparentOnlyTitle: "Wallets transparents seulement",
          deprecatedTitle: "Abandonnés",
        },
      };

    render(
      <WalletList allWallets={parseMarkdown(sectionMarkdown)} />
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Wallets en production (4)",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Wallets bêta (2)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Wallets transparents seulement (2)",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Abandonnés \(2\)/)).toBeInTheDocument();
  });

  it("filters by NU7 status", async () => {
    const user = userEvent.setup();

    render(<WalletList allWallets={wallets} />);

    const sidebar = document.querySelector(".wl-sidebar") as HTMLElement;

    const compatible = await within(sidebar).findByRole("checkbox", {
      name: "Compatible",
    });

    await user.click(compatible);

    expect(screen.getByText("Alive")).toBeInTheDocument();
    expect(screen.queryByText("Gone")).not.toBeInTheDocument();
  });
});
