import { ApiError } from "../../utils/ApiError";
import { hostelRepository } from "./hostel.repository";

function hostelDto(h: any) {
  return {
    id: h.id,
    name: h.name,
    warden: h.warden,
    rooms: h.rooms.map((r: any) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      capacity: r.capacity,
      occupied: r.allocations.length,
    })),
  };
}

export const hostelService = {
  async listHostels() {
    const rows = await hostelRepository.listHostels();
    return rows.map(hostelDto);
  },

  createHostel(data: { name: string; warden?: string }) {
    return hostelRepository.createHostel(data);
  },

  createRoom(hostelId: string, data: { roomNumber: string; capacity: number }) {
    return hostelRepository.createRoom(hostelId, data);
  },

  async allocate(roomId: string, studentId: string) {
    const room = await hostelRepository.findRoom(roomId);
    if (!room) throw ApiError.notFound("Room not found");
    if (room.allocations.length >= room.capacity) {
      throw ApiError.conflict("This room is already at full capacity");
    }
    const existing = await hostelRepository.findActiveAllocationForStudent(studentId);
    if (existing) throw ApiError.conflict("This student already has an active room allocation");

    return hostelRepository.createAllocation(roomId, studentId);
  },

  async vacate(allocationId: string) {
    const allocation = await hostelRepository.findAllocation(allocationId);
    if (!allocation) throw ApiError.notFound("Allocation not found");
    return hostelRepository.vacate(allocationId);
  },

  async myAllocation(studentId: string) {
    const allocation = await hostelRepository.findActiveAllocationForStudent(studentId);
    if (!allocation) return null;
    return {
      hostel: allocation.room.hostel.name,
      roomNumber: allocation.room.roomNumber,
      allocatedAt: allocation.allocatedAt,
    };
  },
};
