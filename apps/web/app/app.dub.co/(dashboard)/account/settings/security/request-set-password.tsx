"use client";

import useUser from "@/lib/swr/use-user";
import { PasswordRequirements } from "@/ui/shared/password-requirements";
import { Button, Input, Label } from "@dub/ui";
import { cn } from "@dub/utils";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { mutate } from "swr";

type SetPasswordForm = { password: string; confirmPassword: string };

// Displayed when the user doesn't have a password set for their account (Google/GitHub
// sign-up). BrewCC: the password is set right here, no email link needed.
export const RequestSetPassword = () => {
  const { user } = useUser();
  const form = useForm<SetPasswordForm>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting, isDirty, errors },
  } = form;

  const onSubmit = handleSubmit(async (data) => {
    if (data.password !== data.confirmPassword) {
      setError("confirmPassword", { message: "Passwords don't match." });
      return;
    }
    try {
      const response = await fetch("/api/user/set-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.password }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        setError("password", { message: error.message });
        return;
      }

      toast.success(
        "Password created. You can now also log in with your email and password.",
      );
      // the page switches to "Update password"
      await mutate("/api/user");
    } catch (error) {
      toast.error(error.message);
    }
  });

  return (
    <form
      className="rounded-xl border border-neutral-200 bg-white"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-medium">Password</h2>
          <p className="pb-2 text-sm text-neutral-500">
            {user?.provider && (
              <>
                Your account is managed by{" "}
                <span
                  className={cn(
                    "font-medium capitalize text-neutral-700",
                    user?.provider === "saml" && "uppercase",
                  )}
                >
                  {user?.provider}
                </span>
                .{" "}
              </>
            )}
            Create a password to also log in with{" "}
            <span className="font-medium text-neutral-700">{user?.email}</span>{" "}
            and a password.
          </p>
        </div>

        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password", { required: true })}
          />
          <FormProvider {...form}>
            <PasswordRequirements field="password" className="mt-0" />
          </FormProvider>
          <span className="block text-sm text-red-500" role="alert">
            {errors.password?.message}
          </span>
        </div>

        <div className="grid w-full max-w-sm items-center gap-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword", { required: true })}
          />
          <span className="block text-sm text-red-500" role="alert">
            {errors.confirmPassword?.message}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end rounded-b-xl border-t border-neutral-200 bg-neutral-50 px-5 py-3">
        <Button
          text="Create Password"
          loading={isSubmitting}
          disabled={!isDirty}
          type="submit"
          className="w-fit"
        />
      </div>
    </form>
  );
};
