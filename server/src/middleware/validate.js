/** Validates and replaces req.body using a zod schema. ZodErrors become 400s in the error handler. */
export const validate = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};
