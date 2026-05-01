type FailedButton = { x: number; y: number; label: string };

export function buildDiscoveryPrompt(
  defaultInstructions: string,
  formatFailedButtons: (list: string) => string,
  hint: string | undefined,
  failedButtons: FailedButton[],
): string {
  if (hint) {
    let prompt = `OPERATOR INSTRUCTION (highest priority — this overrides the default guidance below):\n${hint}\n\nApply the operator instruction above first. If it specifies a sequence of steps, follow them in order and do not skip ahead — re-clicking a previously clicked button is correct if the sequence calls for it. If it specifies constraints or exclusions, honour them while using the default guidance below for anything not covered.\n\n---\n\n${defaultInstructions}`;

    if (failedButtons.length > 0) {
      const list = failedButtons
        .map((button: FailedButton, i: number) => {
          return `  ${i + 1}. "${button.label}" at (${button.x}, ${button.y})`;
        })
        .join('\n');

      prompt += `\n\nClicks made so far this session (use these to track your position in any sequence — the operator instruction may require revisiting some of them):\n${list}`;
    }

    return prompt;
  }

  let prompt = defaultInstructions;

  if (failedButtons.length > 0) {
    const list = failedButtons
      .map((button: FailedButton) => {
        return `- "${button.label}" at (${button.x}, ${button.y})`;
      })
      .join('\n');

    prompt += `\n\n${formatFailedButtons(list)}`;
  }

  return prompt;
}

export type { FailedButton };
