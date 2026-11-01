const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying LoanManagement with account:", deployer.address);

  // Deploy contract with deployer as the initial backend operator
  const LoanManagement = await hre.ethers.getContractFactory("LoanManagement");
  const loanManagement = await LoanManagement.deploy(deployer.address);

  await loanManagement.waitForDeployment();
  const address = await loanManagement.getAddress();

  console.log("LoanManagement deployed successfully to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

