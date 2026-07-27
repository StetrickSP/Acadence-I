import { Router } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import coursesRouter from "./courses";
import enrollmentsRouter from "./enrollments";
import assignmentsRouter from "./assignments";
import gradesRouter from "./grades";
import analyticsRouter from "./analytics";
import predictionsRouter from "./predictions";
import dashboardRouter from "./dashboard";

const router = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(coursesRouter);
router.use(enrollmentsRouter);
router.use(assignmentsRouter);
router.use(gradesRouter);
router.use(analyticsRouter);
router.use(predictionsRouter);
router.use(dashboardRouter);

export default router;
