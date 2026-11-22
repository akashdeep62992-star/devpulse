/** Shared toJSON options: expose `id`, hide `_id`, `__v` and any extra fields. */
export const toJSON = (...hidden) => ({
  virtuals: true,
  transform(_doc, ret) {
    delete ret._id;
    delete ret.__v;
    for (const key of hidden) delete ret[key];
    return ret;
  },
});
