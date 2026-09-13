import { createJob, QueueNames } from '@nibleaf/bullmq';
import { prisma } from '@nibleaf/database';
import { type EmailLanguage, renderMemberInvitationEmail } from '@nibleaf/email';
import { conflict, forbidden, notFound } from '@nibleaf/shared';
import { MemberRole } from '@nibleaf/shared/constants';
import { canAssignRole, canManageMember, planOwnershipTransfer } from '@nibleaf/shared/rbac';
import type { UpdateMemberRoleBody } from '@nibleaf/validators';
import { keys } from './keys';
import { notificationEnabled } from './notifications';

const INVITE_TTL_DAYS = 7;

/** Public-safe metadata for an invitation, used by the accept page and sign-up prefill. */
export const getInvitationInfo = async (invitationId: string) => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { id: true, email: true, role: true, status: true, expiresAt: true, organizationId: true },
  });
  if (!invitation) {
    throw notFound('invitation', { id: invitationId });
  }
  const org = await prisma.organization.findUnique({
    where: { id: invitation.organizationId },
    select: { name: true },
  });
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    organizationName: org?.name ?? null,
    expired: invitation.expiresAt ? new Date(invitation.expiresAt).getTime() < Date.now() : false,
  };
};

export const listMembers = async (organizationId: string) => {
  const [members, invitations] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
    prisma.invitation.findMany({ where: { organizationId, status: 'pending' }, orderBy: { id: 'desc' } }),
  ]);
  return { members, invitations };
};

export const inviteMember = async (
  organizationId: string,
  inviterId: string,
  actorRole: string,
  body: { email: string; role: MemberRole },
  options: { sendEmail?: boolean; bootstrapOwner?: boolean; language?: EmailLanguage; appUrl?: string } = {},
) => {
  if (body.role === MemberRole.OWNER) {
    if (!options.bootstrapOwner) {
      throw forbidden('The owner role cannot be granted by invitation. Transfer ownership instead.', {
        role: body.role,
      });
    }
    const owners = await prisma.member.count({ where: { organizationId, role: MemberRole.OWNER } });
    if (owners > 0) {
      throw conflict('This workspace already has an owner.');
    }
  } else if (!canAssignRole(actorRole, body.role)) {
    throw forbidden('You cannot invite a member with a role higher than your own.', { role: body.role });
  }

  const email = body.email.trim().toLowerCase();
  const existing = await prisma.member.findFirst({
    where: { organizationId, user: { email } },
    select: { id: true },
  });
  if (existing) {
    throw conflict('That person is already a member of this workspace.', { email });
  }
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invitation = await prisma.invitation.create({
    data: { organizationId, email, role: body.role, status: 'pending', expiresAt, inviterId },
  });

  const [org, inviter] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, metadata: true } }),
    prisma.user.findUnique({ where: { id: inviterId }, select: { name: true, email: true } }),
  ]);

  if (options.sendEmail === false || !notificationEnabled(org?.metadata, 'member_invited')) {
    return invitation;
  }
  const appUrl = options.appUrl ?? keys().APP_URL;
  const acceptUrl = `${appUrl}/accept-invite/${invitation.id}`;
  const siteName = org?.name ?? 'a Nibleaf workspace';
  const inviterName = inviter?.name || inviter?.email || 'A teammate';
  const message = await renderMemberInvitationEmail({
    acceptUrl,
    days: INVITE_TTL_DAYS,
    inviterName,
    language: options.language,
    organizationName: siteName,
    role: body.role,
  });
  await createJob(QueueNames.EMAIL, {
    name: 'send-email',
    data: { to: email, ...message },
  }).catch(() => undefined);
  return invitation;
};

export const updateMemberRole = async (organizationId: string, memberId: string, actorRole: string, body: UpdateMemberRoleBody) => {
  const member = await prisma.member.findFirst({ where: { id: memberId, organizationId } });
  if (!member) {
    throw notFound('member', { id: memberId });
  }
  if (!canManageMember(actorRole, member.role)) {
    throw forbidden('You cannot change the role of a member with a higher role than your own.');
  }
  if (!canAssignRole(actorRole, body.role)) {
    throw forbidden('You cannot grant a role higher than your own.', { role: body.role });
  }
  if (member.role === MemberRole.OWNER) {
    const owners = await prisma.member.count({ where: { organizationId, role: MemberRole.OWNER } });
    if (owners <= 1) {
      throw conflict('You cannot demote the last owner of the workspace. Transfer ownership instead.');
    }
  }
  return prisma.member.update({ where: { id: memberId }, data: { role: body.role } });
};

export const transferOwnership = async (organizationId: string, actorUserId: string, targetMemberId: string) => {
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { id: true, userId: true, role: true },
  });
  const actor = members.find((member) => member.userId === actorUserId);
  const plan = planOwnershipTransfer(members, actor?.id ?? '', targetMemberId);
  if (!plan.ok) {
    switch (plan.reason) {
      case 'actor_not_found':
        throw forbidden('You are not a member of this workspace.');
      case 'actor_not_owner':
        throw forbidden('Only the current owner can transfer ownership.');
      case 'target_is_actor':
        throw conflict('Choose another member to transfer ownership to.');
      case 'target_not_found':
        throw notFound('member', { id: targetMemberId });
      case 'target_already_owner':
        throw conflict('That member is already an owner.');
      case 'target_not_admin':
        throw conflict('Ownership can only be transferred to an admin. Make them an admin first.');
      default:
        throw conflict('Ownership transfer could not be completed.');
    }
  }

  const [, promoted] = await prisma.$transaction([
    prisma.member.updateMany({ where: { id: { in: plan.demote }, organizationId }, data: { role: MemberRole.ADMIN } }),
    prisma.member.update({
      where: { id: plan.promote },
      data: { role: MemberRole.OWNER },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
  ]);
  return promoted;
};

export const removeMember = async (organizationId: string, memberId: string, actorRole: string) => {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, role: true },
  });
  if (!member) {
    throw notFound('member', { id: memberId });
  }
  if (!canManageMember(actorRole, member.role)) {
    throw forbidden('You cannot remove a member with a higher role than your own.');
  }
  if (member.role === MemberRole.OWNER) {
    const owners = await prisma.member.count({ where: { organizationId, role: MemberRole.OWNER } });
    if (owners <= 1) {
      throw conflict('You cannot remove the last owner of the workspace.');
    }
  }
  await prisma.member.delete({ where: { id: memberId } });
  return { id: memberId };
};

export const cancelInvitation = async (organizationId: string, invitationId: string) => {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId },
    select: { id: true },
  });
  if (!invitation) {
    throw notFound('invitation', { id: invitationId });
  }
  await prisma.invitation.delete({ where: { id: invitationId } });
  return { id: invitationId };
};
