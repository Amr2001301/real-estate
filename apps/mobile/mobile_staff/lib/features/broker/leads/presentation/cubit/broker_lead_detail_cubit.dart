import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/broker_lead.dart';
import '../../domain/usecases/broker_lead_use_cases.dart';

typedef BrokerLeadDetailState = DataState<BrokerLeadDetail>;

class BrokerLeadDetailCubit extends Cubit<BrokerLeadDetailState> {
  BrokerLeadDetailCubit(this._getDetail, {required this.leadId})
      : super(const BrokerLeadDetailState.initial());

  final GetBrokerLeadDetail _getDetail;
  final String leadId;

  Future<void> load() async {
    emit(state.toLoading());
    final result = await _getDetail(leadId);
    result.when(
      ok: (detail) => emit(BrokerLeadDetailState.success(detail)),
      err: (failure) => emit(state.toFailure(failure)),
    );
  }
}
