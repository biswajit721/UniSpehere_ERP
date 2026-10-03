import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Request, Response } from "express"; // <-- Added Request and Response
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRateLimiter } from "./middleware/rateLimiter";
import academicsRoutes from "./modules/academics/academics.routes";
import administrationRoutes from "./modules/administration/administration.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import authRoutes from "./modules/auth/auth.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import departmentsRoutes from "./modules/departments/departments.routes";
import documentsRoutes from "./modules/documents/documents.routes";
import examinationRoutes from "./modules/examination/examination.routes";
import facultyRoutes from "./modules/faculty/faculty.routes";
import feesRoutes from "./modules/fees/fees.routes";
import chatbotRoutes from "./modules/chatbot/chatbot.routes";
import grievanceRoutes from "./modules/grievance/grievance.routes";
import hostelRoutes from "./modules/hostel/hostel.routes";
import idcardRoutes from "./modules/idcard/idcard.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import insightsRoutes from "./modules/insights/insights.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import libraryRoutes from "./modules/library/library.routes";
import noticesRoutes from "./modules/notices/notices.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import placementRoutes from "./modules/placement/placement.routes";
import studentsRoutes from "./modules/students/students.routes";
import timetableRoutes from "./modules/timetable/timetable.routes";
import usersRoutes from "./modules/users/users.routes";

const app = express();

// Render (and most PaaS providers) put the app behind a reverse proxy that terminates TLS.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
app.use("/api", apiRateLimiter);

// Explicitly typed parameters to prevent TS7006 implicit 'any' errors
app.get("/api/health", (_req: Request, res: Response) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/academics", academicsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/examination", examinationRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/placement", placementRoutes);
app.use("/api/notices", noticesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/grievance", grievanceRoutes);
app.use("/api/administration", administrationRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/hostel", hostelRoutes);
app.use("/api/idcard", idcardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/chatbot", chatbotRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;