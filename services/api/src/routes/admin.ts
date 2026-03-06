import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("admin"));

// GET /api/admin/clinics — List clinics
adminRouter.get("/clinics", async (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

// POST /api/admin/clinics — Create clinic
adminRouter.post("/clinics", async (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

// POST /api/admin/clinics/:id/doctors — Add doctor to clinic
adminRouter.post("/clinics/:id/doctors", async (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

// DELETE /api/admin/clinics/:id/doctors/:doctorId — Remove doctor from clinic
adminRouter.delete("/clinics/:id/doctors/:doctorId", async (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

// PATCH /api/admin/users/:id/role — Change user role
adminRouter.patch("/users/:id/role", async (req, res) => {
  res.status(501).json({ message: "Not implemented" });
});
