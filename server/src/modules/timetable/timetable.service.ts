import { ApiError } from "../../utils/ApiError";
import { timetableRepository } from "./timetable.repository";

function toDto(slot: any) {
  return {
    id: slot.id,
    subject: slot.subject.name,
    subjectId: slot.subjectId,
    facultyName: `${slot.faculty.user.firstName} ${slot.faculty.user.lastName}`,
    facultyId: slot.facultyId,
    section: slot.section?.name,
    sectionId: slot.sectionId,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
  };
}

export const timetableService = {
  async list(params: { sectionId?: string; facultyId?: string }) {
    const rows = await timetableRepository.list(params);
    return rows.map(toDto);
  },

  async create(input: {
    subjectId: string;
    facultyId: string;
    sectionId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string;
  }) {
    const overlaps = await timetableRepository.findOverlapping(input);
    if (overlaps.length > 0) {
      const conflict = overlaps[0];
      const isFacultyConflict = conflict.facultyId === input.facultyId;
      throw ApiError.conflict(
        isFacultyConflict
          ? `This faculty member already has "${conflict.subject.name}" scheduled from ${conflict.startTime} to ${conflict.endTime} on this day.`
          : `This section already has a class scheduled from ${conflict.startTime} to ${conflict.endTime} on this day.`
      );
    }
    const slot = await timetableRepository.create(input);
    return toDto(slot);
  },

  async remove(id: string) {
    await timetableRepository.delete(id);
  },
};
