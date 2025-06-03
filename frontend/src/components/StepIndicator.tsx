"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  title: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, className, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={cn("mb-12", className)}>
      <ol role="list" className="flex flex-col space-y-4 sm:space-y-6">
        {steps.map((step, index) => (
          <li key={step.title} className="relative">
            <div className="flex items-start">
              <div className="flex items-center">
                <span
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2",
                    index < currentStep
                      ? "border-primary bg-primary text-primary-foreground"
                      : index === currentStep
                      ? "border-primary text-primary"
                      : "border-muted-foreground/50 text-muted-foreground",
                    onStepClick && index <= currentStep ? "cursor-pointer hover:opacity-80" : ""
                  )}
                  onClick={() => {
                    if (onStepClick && index <= currentStep) {
                      onStepClick(index);
                    }
                  }}
                >
                  {index < currentStep ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  )}
                </span>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-5 top-10 h-full w-0.5",
                      index < currentStep ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="ml-4 min-w-0 flex-1">
                <div className="flex items-center">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      index <= currentStep ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
