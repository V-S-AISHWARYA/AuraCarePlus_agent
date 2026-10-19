# AuraCare+ demo checklist

1. Show the Senior view and the `Simulated Alexa+ experience` label.
2. Show the caregiver dashboard and the Live MCP connection card.
3. Run `pnpm verify:mcp` and show PASS lines for all tool names.
4. Click `Simulate morning activity` and show the new `get_medication_status` call in the MCP tool calls panel.
5. Click `Test safe refusal` and show the fixed refusal plus caregiver notification.
6. Run the Wrong bottle scenario and show `NEEDS_HUMAN_CONFIRMATION` and the alert.
7. End on the footer: AuraCare+ is a wellness assistant, not a medical device.
