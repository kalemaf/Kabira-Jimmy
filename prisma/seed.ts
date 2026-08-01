import { auth } from "../lib/auth";
import { db } from "../lib/db";
import { postLedgerEntries, ACCOUNTS } from "../lib/ledger";
import type { StaffRole } from "../lib/generated/prisma/client";

const DEMO_PASSWORD = "DevPass12345!";

const FIRST_NAMES = [
  "Aisha", "Brian", "Catherine", "David", "Esther", "Francis", "Grace", "Henry",
  "Irene", "James", "Josephine", "Kato", "Lillian", "Moses", "Nakato", "Okello",
  "Patricia", "Quinn", "Robert", "Sarah", "Timothy", "Ummi", "Vincent", "Winnie",
  "Xavier", "Yusuf", "Zainab", "Allan", "Betty", "Charles", "Diana", "Emmanuel",
  "Faith", "George", "Harriet", "Isaac", "Jane", "Kenneth", "Loyce", "Michael",
  "Norah", "Opio", "Prossy", "Richard", "Stella", "Tonny", "Uzziah", "Violet",
  "Wycliffe", "Yvonne",
];
const LAST_NAMES = [
  "Nakirya", "Ssemwogerere", "Auma", "Byaruhanga", "Nabirye", "Kigozi", "Achieng",
  "Mugisha", "Namutebi", "Okwir", "Kansiime", "Wamala", "Nakimuli", "Tumwesigye",
  "Adong", "Ssebunya", "Nantongo", "Opio", "Kyomuhendo", "Mubiru", "Nassuna",
  "Kwizera", "Namuli", "Businge", "Akello", "Ssenyonga", "Nakawesa", "Twinomujuni",
  "Alupo", "Kirabo",
];
const DISTRICTS = [
  { district: "Kampala", subCounty: "Nakawa", village: "Bugolobi" },
  { district: "Wakiso", subCounty: "Kira", village: "Kyaliwajjala" },
  { district: "Mbarara", subCounty: "Kakoba", village: "Nyamityobora" },
  { district: "Gulu", subCounty: "Bardege", village: "Layibi" },
  { district: "Jinja", subCounty: "Central", village: "Walukuba" },
  { district: "Mukono", subCounty: "Goma", village: "Seeta" },
];
const OCCUPATIONS = [
  "Market Vendor", "Boda Boda Rider", "Teacher", "Nurse", "Shopkeeper",
  "Tailor", "Farmer", "Mechanic", "Civil Servant", "Hairdresser",
  "Carpenter", "Driver", "Restaurant Owner", "Electrician", "Accountant",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function phoneFor(seed: number) {
  return `+2567${String(10000000 + seed).slice(0, 8)}`;
}

async function ensureStaff(
  email: string,
  name: string,
  role: StaffRole,
  branchId: string
) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({ where: { email }, data: { role, branchId } });
    return existing.id;
  }

  const signUp = await auth.api.signUpEmail({
    body: { email, password: DEMO_PASSWORD, name },
  });
  await db.user.update({
    where: { id: signUp.user.id },
    data: { role, branchId, emailVerified: true },
  });
  return signUp.user.id;
}

async function main() {
  console.log("Seeding branches...");
  const branchSeeds = [
    { name: "Kampala Head Office", code: "HQ-KLA", district: "Kampala", address: "Plot 12, Kampala Road", phone: "+256414123456" },
    { name: "Mbarara Branch", code: "BR-MBR", district: "Mbarara", address: "High Street, Mbarara", phone: "+256485123456" },
    { name: "Gulu Branch", code: "BR-GUL", district: "Gulu", address: "Airfield Road, Gulu", phone: "+256471123456" },
    { name: "Jinja Branch", code: "BR-JJA", district: "Jinja", address: "Main Street, Jinja", phone: "+256434123456" },
  ];

  const branches = [];
  for (const b of branchSeeds) {
    const branch = await db.branch.upsert({
      where: { code: b.code },
      update: {},
      create: b,
    });
    branches.push(branch);
  }
  const [hq, mbarara, gulu, jinja] = branches;

  console.log("Seeding staff across all roles...");
  const staffSeeds: { email: string; name: string; role: StaffRole; branchId: string }[] = [
    { email: "manager.hq@nextgensacco.test", name: "Patricia Nakirya", role: "Manager", branchId: hq.id },
    { email: "accounts.hq@nextgensacco.test", name: "Robert Byaruhanga", role: "AccountsOfficer", branchId: hq.id },
    { email: "auditor.hq@nextgensacco.test", name: "Sarah Auma", role: "Auditor", branchId: hq.id },
    { email: "treasurer.mbarara@nextgensacco.test", name: "Vincent Mugisha", role: "Treasurer", branchId: mbarara.id },
    { email: "secretary.mbarara@nextgensacco.test", name: "Grace Namutebi", role: "Secretary", branchId: mbarara.id },
    { email: "loanofficer.mbarara@nextgensacco.test", name: "James Kansiime", role: "LoanOfficer", branchId: mbarara.id },
    { email: "cashier.mbarara@nextgensacco.test", name: "Esther Wamala", role: "Cashier", branchId: mbarara.id },
    { email: "secretary.gulu@nextgensacco.test", name: "Francis Okwir", role: "Secretary", branchId: gulu.id },
    { email: "loanofficer.gulu@nextgensacco.test", name: "Irene Adong", role: "LoanOfficer", branchId: gulu.id },
    { email: "recovery.gulu@nextgensacco.test", name: "Moses Tumwesigye", role: "RecoveryOfficer", branchId: gulu.id },
    { email: "cashier.jinja@nextgensacco.test", name: "Josephine Nantongo", role: "Cashier", branchId: jinja.id },
    { email: "recovery.jinja@nextgensacco.test", name: "Henry Ssebunya", role: "RecoveryOfficer", branchId: jinja.id },
  ];

  for (const s of staffSeeds) {
    await ensureStaff(s.email, s.name, s.role, s.branchId);
  }
  console.log(`  ${staffSeeds.length} staff accounts ready (password for all: ${DEMO_PASSWORD})`);

  console.log("Seeding loan products...");
  const loanProductSeeds = [
    { name: "Emergency Loan", interestRate: 3, minAmount: 50_000, maxAmount: 1_000_000, repaymentPeriodMonths: 3, gracePeriodDays: 3, penaltyRate: 2, processingFee: 1, insuranceFee: 0.5, lateFee: 1, serviceCharge: 0.5, interestMethod: "Flat" as const },
    { name: "Salary Loan", interestRate: 2, minAmount: 200_000, maxAmount: 5_000_000, repaymentPeriodMonths: 12, gracePeriodDays: 0, penaltyRate: 1.5, processingFee: 1, insuranceFee: 0.5, lateFee: 1, serviceCharge: 0.5, interestMethod: "ReducingBalance" as const },
    { name: "Business Loan", interestRate: 2.5, minAmount: 500_000, maxAmount: 20_000_000, repaymentPeriodMonths: 24, gracePeriodDays: 14, penaltyRate: 2, processingFee: 1.5, insuranceFee: 1, lateFee: 1.5, serviceCharge: 1, interestMethod: "ReducingBalance" as const },
    { name: "Agricultural Loan", interestRate: 1.8, minAmount: 300_000, maxAmount: 10_000_000, repaymentPeriodMonths: 18, gracePeriodDays: 30, penaltyRate: 1.5, processingFee: 1, insuranceFee: 1, lateFee: 1, serviceCharge: 0.5, interestMethod: "Declining" as const },
    { name: "School Fees Loan", interestRate: 2, minAmount: 100_000, maxAmount: 3_000_000, repaymentPeriodMonths: 6, gracePeriodDays: 0, penaltyRate: 2, processingFee: 1, insuranceFee: 0.5, lateFee: 1, serviceCharge: 0.5, interestMethod: "Flat" as const },
    { name: "Development Loan", interestRate: 2.2, minAmount: 1_000_000, maxAmount: 30_000_000, repaymentPeriodMonths: 36, gracePeriodDays: 30, penaltyRate: 1.5, processingFee: 1.5, insuranceFee: 1, lateFee: 1, serviceCharge: 1, interestMethod: "ReducingBalance" as const },
  ];

  const existingProductCount = await db.loanProduct.count();
  if (existingProductCount === 0) {
    for (const p of loanProductSeeds) {
      await db.loanProduct.create({ data: p });
    }
    console.log(`  ${loanProductSeeds.length} loan products created`);
  } else {
    console.log(`  ${existingProductCount} loan products already exist — skipping`);
  }

  console.log("Seeding members...");
  const statuses: Array<"Active" | "Inactive" | "Suspended"> = [
    "Active", "Active", "Active", "Active", "Active", "Active", "Active", "Inactive", "Suspended",
  ];

  const existingMemberCount = await db.member.count();
  const members = [];
  if (existingMemberCount === 0) {
    for (let i = 0; i < 55; i++) {
      const firstName = pick(FIRST_NAMES, i);
      const lastName = pick(LAST_NAMES, i * 7 + 3);
      const loc = pick(DISTRICTS, i * 3 + 1);
      const branch = pick(branches, i);
      const status = pick(statuses, i * 5 + 2);
      const gender = i % 2 === 0 ? "Female" : "Male";
      const dob = new Date(1970 + (i % 40), i % 12, (i % 27) + 1);

      const member = await db.member.create({
        data: {
          memberNumber: `NGS-${String(i + 1).padStart(6, "0")}`,
          firstName,
          lastName,
          phone: phoneFor(i),
          email: i % 3 === 0 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com` : null,
          nin: `CM${String(80000000 + i * 37).padStart(8, "0")}${String.fromCharCode(65 + (i % 26))}${String(i).padStart(2, "0")}`,
          dob,
          gender,
          occupation: pick(OCCUPATIONS, i * 2 + 1),
          employer: i % 4 === 0 ? "Self-employed" : `${pick(OCCUPATIONS, i)} Co. Ltd`,
          district: loc.district,
          subCounty: loc.subCounty,
          village: loc.village,
          status,
          nextOfKinName: `${pick(FIRST_NAMES, i + 11)} ${pick(LAST_NAMES, i + 13)}`,
          nextOfKinPhone: phoneFor(i + 500),
          emergencyContact: phoneFor(i + 900),
          branchId: branch.id,
        },
      });
      members.push(member);
    }
    console.log(`  ${members.length} members created`);
  } else {
    console.log(`  ${existingMemberCount} members already exist — skipping member seed`);
    members.push(...(await db.member.findMany({ take: 55 })));
  }

  console.log("Seeding guarantors...");
  const existingGuarantorCount = await db.guarantor.count();
  if (existingGuarantorCount === 0 && members.length > 1) {
    for (let i = 0; i < Math.min(15, members.length - 1); i++) {
      await db.guarantor.create({
        data: {
          memberId: members[i + 1].id,
          guaranteeAmount: 200_000 + i * 50_000,
          status: "Active",
        },
      });
    }
    console.log("  15 guarantor records created");
  } else {
    console.log("  guarantors already exist — skipping");
  }

  console.log("Seeding chart of accounts...");
  const chartSeeds = [
    { code: ACCOUNTS.CASH, name: "Cash", type: "Asset" as const },
    { code: ACCOUNTS.BANK, name: "Bank", type: "Asset" as const },
    { code: ACCOUNTS.LOANS_RECEIVABLE, name: "Loans Receivable", type: "Asset" as const },
    { code: "1200", name: "Office Equipment", type: "Asset" as const },
    { code: ACCOUNTS.SAVINGS_DEPOSITS, name: "Member Savings Deposits", type: "Liability" as const },
    { code: "2100", name: "Accounts Payable", type: "Liability" as const },
    { code: ACCOUNTS.MEMBER_SHARES, name: "Member Shares", type: "Equity" as const },
    { code: "3100", name: "Retained Earnings", type: "Equity" as const },
    { code: ACCOUNTS.INTEREST_INCOME, name: "Interest Income", type: "Revenue" as const },
    { code: ACCOUNTS.PENALTY_INCOME, name: "Penalty Income", type: "Revenue" as const },
    { code: ACCOUNTS.FEE_INCOME, name: "Fee Income", type: "Revenue" as const },
    { code: "5000", name: "Salaries Expense", type: "Expense" as const },
    { code: "5010", name: "Rent Expense", type: "Expense" as const },
    { code: "5020", name: "Office Supplies Expense", type: "Expense" as const },
    { code: "5030", name: "Loan Loss Provision", type: "Expense" as const },
  ];
  for (const account of chartSeeds) {
    await db.chartOfAccount.upsert({ where: { code: account.code }, update: {}, create: account });
  }
  console.log(`  ${chartSeeds.length} chart-of-account entries ready`);

  console.log("Seeding savings accounts...");
  const existingSavingsCount = await db.savingsAccount.count();
  if (existingSavingsCount === 0 && members.length > 0) {
    const savingsTypes: Array<"Daily" | "Fixed" | "Shares"> = ["Daily", "Daily", "Daily", "Fixed", "Shares"];
    const cashier = await db.user.findUnique({ where: { email: "cashier.mbarara@nextgensacco.test" } });
    let created = 0;
    for (let i = 0; i < Math.min(30, members.length); i++) {
      const member = members[i];
      const type = pick(savingsTypes, i);
      const openingDeposit = 50_000 + (i % 10) * 25_000;

      const account = await db.savingsAccount.create({
        data: {
          accountNumber: `SAV-${String(i + 1).padStart(6, "0")}`,
          memberId: member.id,
          type,
          balance: openingDeposit,
        },
      });
      await db.savingsTransaction.create({
        data: {
          savingsAccountId: account.id,
          type: "Deposit",
          amount: openingDeposit,
          balanceAfter: openingDeposit,
          branchId: member.branchId,
          staffId: cashier!.id,
        },
      });
      await postLedgerEntries([
        {
          accountCode: ACCOUNTS.CASH,
          description: `Opening deposit — ${account.accountNumber}`,
          debit: openingDeposit,
          branchId: member.branchId,
          referenceType: "SavingsAccount",
          referenceId: account.id,
        },
        {
          accountCode: ACCOUNTS.SAVINGS_DEPOSITS,
          description: `Opening deposit — ${account.accountNumber}`,
          credit: openingDeposit,
          branchId: member.branchId,
          referenceType: "SavingsAccount",
          referenceId: account.id,
        },
      ]);
      created++;
    }
    console.log(`  ${created} savings accounts created with opening deposits`);
  } else {
    console.log(`  ${existingSavingsCount} savings accounts already exist — skipping`);
  }

  console.log("✓ Database seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
