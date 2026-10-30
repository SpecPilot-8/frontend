export const PROJECT_STACKS = [
  { value: "auto", label: "자동 감지 (기본)" },
  { value: "spring", label: "Java / Spring Boot" },
  { value: "react", label: "JavaScript / React · Express" },
  { value: "typescript", label: "TypeScript (텍스트 분석)" },
];

export const projectStackLabel = (value?: string) =>
  PROJECT_STACKS.find((stack) => stack.value === value)?.label || PROJECT_STACKS[0].label;
