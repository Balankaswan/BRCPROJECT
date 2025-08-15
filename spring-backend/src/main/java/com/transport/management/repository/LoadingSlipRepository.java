package com.transport.management.repository;

import com.transport.management.model.LoadingSlip;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LoadingSlipRepository extends MongoRepository<LoadingSlip, String> {
    
    Optional<LoadingSlip> findBySlipNumber(String slipNumber);
    
    List<LoadingSlip> findByPartyNameContainingIgnoreCase(String partyName);
    
    List<LoadingSlip> findByVehicleNumberContainingIgnoreCase(String vehicleNumber);
    
    List<LoadingSlip> findByFromLocationContainingIgnoreCase(String fromLocation);
    
    List<LoadingSlip> findByToLocationContainingIgnoreCase(String toLocation);
    
    List<LoadingSlip> findByMaterialTypeContainingIgnoreCase(String materialType);
    
    List<LoadingSlip> findByLoadingDateBetween(String startDate, String endDate);
    
    List<LoadingSlip> findBySupplierDetailContainingIgnoreCase(String supplierDetail);
    
    // Find all slips ordered by creation date (newest first)
    List<LoadingSlip> findAllByOrderByCreatedAtDesc();
    
    boolean existsBySlipNumber(String slipNumber);
}
