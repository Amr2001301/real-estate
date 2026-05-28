import '../../domain/entities/broker_profile.dart';
import '../dtos/broker_profile_dto.dart';

extension BrokerProfileDtoMapper on BrokerProfileDto {
  BrokerProfile toEntity() => BrokerProfile(
        canViewCommissions: canViewCommissions,
        isPrimaryContact: isPrimaryContact,
        canManageBrokerUsers: canManageBrokerUsers,
        fullName: fullName,
        email: email,
        phone: phone,
        jobTitle: jobTitle,
        companyName: companyName,
        brokerCode: brokerCode,
      );
}
