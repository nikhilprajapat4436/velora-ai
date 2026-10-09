const getCurrentDateTime = (timezone = "Asia/Kolkata") => {
  if (!timezone || typeof timezone !== "string") {
    throw new Error("Timezone is required");
  }

  try {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "long",
    });

    return {
      timezone,
      dateTime: formatter.format(now),
      iso: now.toISOString(),
    };
  } catch (error) {
    throw new Error("Invalid timezone", { cause: error });
  }
};

export default getCurrentDateTime;
