package com.transport.management.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "loading_slips")
public class LoadingSlip {
    
    @Id
    private String id;
    
    @NotBlank(message = "Slip number is required")
    @Indexed(unique = true)
    private String slipNumber;
    
    @NotBlank(message = "Loading date is required")
    private String loadingDate;
    
    @NotBlank(message = "Vehicle number is required")
    private String vehicleNumber;
    
    @NotBlank(message = "From location is required")
    private String fromLocation;
    
    @NotBlank(message = "To location is required")
    private String toLocation;
    
    @NotBlank(message = "Party name is required")
    private String partyName;
    
    private String partyPersonName;
    
    private String supplierDetail;
    
    @NotBlank(message = "Material type is required")
    private String materialType;
    
    @NotNull(message = "Weight is required")
    @Positive(message = "Weight must be positive")
    private Double weight;
    
    private String dimensions;
    
    @NotNull(message = "Freight amount is required")
    @Positive(message = "Freight must be positive")
    private Double freight;
    
    private Double rtoAmount = 0.0;
    
    private Double advance = 0.0;
    
    // Linked references
    private String linkedMemoNumber;
    private String linkedBillNumber;
    
    // Audit fields
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
    
}
