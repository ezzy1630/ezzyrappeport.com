/** Public sources inspected on 2026-09-07. Pins keep the case-study evidence reviewable. */
const downrightRevision = "18e46e3a583bd8ece34e15f286346ca582bf5a1b";
const monkeyRevision = "cd1507cbb52a91d45821f75ed89e7c3657da4305";
const downrightRoot = `https://github.com/ezzy1630/Downright/blob/${downrightRevision}`;
const monkeyRoot = `https://github.com/justin06lee/monkeyclaw/blob/${monkeyRevision}`;

export const downrightEvidence = {
  architecture: `${downrightRoot}/Docs/ARCHITECTURE.md`,
  quickLook: `${downrightRoot}/Docs/QUICKLOOK.md`,
  recording: `${downrightRoot}/Docs/downright-readme-demo.gif`,
  capture: `${downrightRoot}/Docs/downright-renderer-showcase.png`,
};

export const monkeyEvidence = {
  fixture: `${monkeyRoot}/demo/fixtures/seed.db`,
  demo: `${monkeyRoot}/demo/README.md`,
  oracle: `${monkeyRoot}/purple_team/detection_oracle.py#L65-L80`,
  verifier: `${monkeyRoot}/blue_team/patch_verifier.py#L750-L775`,
  mock: `${monkeyRoot}/red_team/mock_victim.py`,
  telemetryContribution: "https://github.com/justin06lee/monkeyclaw/commit/5112da4ae0ae6bbea8e74d5a6c18479fbe6ce592",
  reproductionContribution: "https://github.com/justin06lee/monkeyclaw/commit/3b4266277acc672f972e7d46954c1d4aeb15bd81",
  dashboardContribution: "https://github.com/justin06lee/monkeyclaw/commit/49d6df22153515d06bfb77b26f04f13773df55e3",
};

export const recordedFinding = {
  id: "FND-e4b8317b684d",
  package: "MC-2026-0001",
  zone: "SBX-FS",
  check: "filesystem_breach",
  verdict: "confirmed",
  originalRequests: 2,
  reproductionRequests: 1,
  patchStatus: "No patch recorded",
} as const;
