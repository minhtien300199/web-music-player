---
title: "Popup Settings and YouTube Controls Regression Fix"
date: 2026-07-29
tags: [chrome-extension, popup, regression, security]
---

# Popup Settings and YouTube Controls Regression Fix

## Context

The popup Settings and YouTube controls regressed after the popup UI changed.

## What happened

- The popup controller queried the previous element ID, so its initialization stopped before wiring the current controls.
- Corrected the ID reference and added regression coverage for the Settings and YouTube control behavior.
- Hardened background message handling by validating the sender before accepting privileged popup requests.

## Decisions

Treat popup element IDs as an integration contract: controller initialization and authorization checks must be covered together whenever popup controls change.

## Next

Run the extension's manual Chrome validation to confirm the repaired controls work in the packaged MV3 runtime.
